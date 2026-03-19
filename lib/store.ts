"use client";

import { Filesystem, Directory } from '@capacitor/filesystem';
import { Browser } from '@capacitor/browser';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { toast } from 'sonner';

// --- CONFIGURATION ---
let API_BASE = "https://groupegsi.mg/rtmggmg/api";
let MEDIA_BASE = "https://groupegsi.mg/rtmggmg";
let ADMIN_CODE = "Nina GSI";
let PROF_PASS = "prof-gsi-mg";
let configPromise: Promise<any> | null = null;

// Types
export interface User {
  id: string; // Internal/Public UID
  fullName: string;
  email: string;
  password?: string; // Stored for custom auth
  role: 'student' | 'professor' | 'admin';
  campus: string;
  filiere: string;
  niveau: string;
  photo?: string;
  matricule?: string;
  contact?: string;
  _id?: string; // API internal ID
}

export interface Lesson { id: string; title: string; description: string; subject: string; niveau: string; filiere: string[]; campus: string[]; date: string; files: string[]; _id?: string; }
export interface Assignment { id: string; title: string; description: string; subject: string; niveau: string; filiere: string[]; campus: string[]; deadline: string; timeLimit: string; maxScore: number; files?: string[]; _id?: string; }
export interface Submission { id: string; assignmentId: string; studentId: string; studentName: string; date: string; file: string; score?: number; feedback?: string; _id?: string; }
export interface Grade { id: string; studentId: string; studentName: string; subject: string; score: number; maxScore: number; date: string; niveau: string; filiere: string; _id?: string; }
export interface Announcement { id: string; title: string; message: string; date: string; author: string; type?: 'info' | 'convocation'; targetUserId?: string; campus?: string[]; filiere?: string[]; niveau?: string; _id?: string; }

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  replyTo?: {
    senderName: string;
    text: string;
  };
  timestamp: string;
  filiere: string;
  niveau: string;
  _id?: string;
}

export interface Reminder {
  id: string;
  title: string;
  date: string; // ISO date
  time: string; // HH:mm
  subject: string;
  notes?: string;
  completed: boolean;
  isAlarm?: boolean;
}

export interface ScheduleSlot {
  day: string; // "Lundi", "Mardi", ...
  startTime: string;
  endTime: string;
  subject: string;
  room: string;
  instructor: string;
  color?: string;
}

export interface StructuredSchedule {
  id: string;
  campus: string;
  niveau: string;
  lastUpdated: string;
  slots: ScheduleSlot[];
  url?: string;
  fileUrl?: string;
  data?: any;
  _id?: string;
}

interface State {
  currentUser: User | null;
  users: User[];
  lessons: Lesson[];
  assignments: Assignment[];
  submissions: Submission[];
  grades: Grade[];
  announcements: Announcement[];
  schedules: Record<string, StructuredSchedule>;
  messages: ChatMessage[];
  reminders: Reminder[];
}

const initialState: State = {
  currentUser: null,
  users: [],
  lessons: [],
  assignments: [],
  submissions: [],
  grades: [],
  announcements: [],
  schedules: {},
  messages: [],
  reminders: []
};

class GSIStoreClass {
  private state: State = { ...initialState };
  private listeners: Record<string, ((data: any) => void)[]> = {};
  private saveTimeout: any = null;
  private syncingCount = 0;
  private apiCache: Record<string, { data: any, ts: number }> = {};

  constructor() {
    if (typeof window !== 'undefined') {
      this.hydrate();
      this.initRemoteConfig();
      // Wait a bit before syncing to let UI render first
      setTimeout(() => this.startGlobalSync(), 2000);
      window.addEventListener('beforeunload', () => this.saveImmediate());
    }
  }

  private async initRemoteConfig() {
    if (configPromise) return configPromise;

    configPromise = (async () => {
      try {
        // Try multiple paths for config
        const paths = ['/web/api/config', '/api/config', './api/config'];
        for (const path of paths) {
          try {
            const res = await fetch(path);
            if (res.ok) {
              const config = await res.json();
              if (config.API_BASE) API_BASE = config.API_BASE;
              if (config.MEDIA_BASE) MEDIA_BASE = config.MEDIA_BASE;
              if (config.ADMIN_CODE) ADMIN_CODE = config.ADMIN_CODE;
              if (config.PROF_PASS) PROF_PASS = config.PROF_PASS;
              console.log(`GSIStore: Config loaded from ${path}`, { API_BASE, MEDIA_BASE });
              return config;
            }
          } catch (e) {}
        }
      } catch (e) {
        console.warn("GSIStore: Failed to load remote config, using defaults");
      }
      return { API_BASE, MEDIA_BASE };
    })();

    return configPromise;
  }

  public async ensureConfig() {
    if (typeof window === 'undefined') return;
    return this.initRemoteConfig();
  }

  private hydrate() {
    try {
      const saved = localStorage.getItem('gsi_v8_master');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Deep merge to preserve structure if interface changes
        this.state = { ...initialState, ...parsed };
      }
      if (this.state.users.length === 0) this.generateMockData();
    } catch (e) {
      console.error("Hydration failed", e);
    }
  }

  private generateMockData() {
    const mockUsers: User[] = [
      { id: 'admin-id', fullName: 'Nina GSI', email: 'admin@gsi.mg', password: 'password', role: 'admin', campus: 'Antananarivo', filiere: 'Directeur', niveau: 'N/A' },
      { id: 'prof-id', fullName: 'Professeur GSI', email: 'prof@gsi.mg', password: 'password', role: 'professor', campus: 'Antananarivo', filiere: 'Informatique', niveau: 'L1' }
    ];

    mockUsers.forEach(mu => {
      if (!this.state.users.find(u => u.id === mu.id)) {
        this.state.users.push(mu);
      }
    });

    if (this.state.lessons.length === 0) {
      this.state.lessons = [
        { id: 'l1', title: 'Guide GSI Insight', description: 'Bienvenue.', subject: 'Général', niveau: 'L1', filiere: [], campus: [], date: new Date().toISOString(), files: [] }
      ];
    }
    this.saveImmediate();
  }

  private save() {
    if (typeof window !== 'undefined') {
      if (this.saveTimeout) clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => this.saveImmediate(), 500);
    }
  }

  private saveImmediate() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('gsi_v8_master', JSON.stringify(this.state));
      } catch (e) {
        console.error("Failed to save GSIStore state", e);
      }
    }
  }

  private notify(key: string, data: any) {
    if (this.listeners[key]) {
      this.listeners[key].forEach(cb => { try { cb(data); } catch(e) {} });
    }
    Object.keys(this.listeners).forEach(subKey => {
      if (subKey !== key && subKey.startsWith(key + '_')) {
        this.listeners[subKey].forEach(cb => { try { cb(data); } catch(e) {} });
      }
    });
  }

  private startGlobalSync() {
    // Initial aggressive sync
    this.syncAll().then(() => {
       this.autoDownloadEssentials();
    });

    // Background polling for general data
    setInterval(() => {
       this.syncAll();
    }, 30000);

    // Background polling for chat (Faster for better UX)
    setInterval(() => {
       if (this.state.currentUser) {
         this.fetchChatMessages();
       }
    }, 8000);

    // Background polling for announcements/notifications
    setInterval(() => {
      if (this.state.currentUser) {
        this.fetchCollection('announcements', 'announcements');
      }
    }, 20000);
  }

  private async autoDownloadEssentials() {
     if (!this.state.currentUser) return;
     const { campus, niveau } = this.state.currentUser;

     // Auto-download current schedule if structured
     const sched = this.state.schedules[`${campus}_${niveau}`];
     if (sched && (sched.fileUrl || sched.url)) {
        try {
           await this.downloadPackFile(sched.fileUrl || sched.url!, `Schedule_${campus}_${niveau}.pdf`, sched.id);
        } catch (e) {}
     }
  }

  private async syncAll() {
     return Promise.all([
       this.fetchCollection('users', 'users'),
       this.fetchCollection('lessons', 'lessons'),
       this.fetchCollection('assignments', 'assignments'),
       this.fetchCollection('announcements', 'announcements'),
       this.fetchCollection('grades', 'grades'),
       this.fetchCollection('schedules', 'schedules'),
       this.fetchChatMessages()
     ]);
  }

  private async fetchChatMessages() {
    if (!this.state.currentUser) return;
    const { filiere, niveau } = this.state.currentUser;
    const q = encodeURIComponent(JSON.stringify({ filiere, niveau }));
    const data = await this.apiCall(`/db/messages?q=${q}&s={"timestamp":-1}&l=60`);
    if (data && Array.isArray(data)) {
      const newMessages = data.reverse();
      // Only update if something changed
      if (JSON.stringify(newMessages) !== JSON.stringify(this.state.messages)) {
        this.state.messages = newMessages;
        this.notify('messages', this.state.messages);
      }
    }
  }

  // --- API HELPERS ---

  private async apiCall(endpoint: string, method = 'GET', body?: any, redirectCount = 0): Promise<any> {
    if (redirectCount > 3) return null;

    // SMART CACHING:
    // - 3 seconds for messages/chat
    // - 5 minutes (300000ms) for stable academic data to maximize speed
    const cacheTime = endpoint.includes('messages') ? 3000 : 300000;

    if (method === 'GET' && this.apiCache[endpoint] && (Date.now() - this.apiCache[endpoint].ts < cacheTime)) {
       return this.apiCache[endpoint].data;
    }

    this.syncingCount++;
    this.notify('sync_status', true);

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    try {
      let response: any;

      if (Capacitor.isNativePlatform()) {
        const options = {
          url,
          method,
          headers: { 'Content-Type': 'application/json' },
          data: body,
          connectTimeout: 15000,
          readTimeout: 15000
        };
        response = await CapacitorHttp.request(options);

        // Manual Redirect Handling for 301/302/307/308
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers['Location'] || response.headers['location'];
          if (location) {
            this.syncingCount = Math.max(0, this.syncingCount - 1);
            return this.apiCall(location, method, body, redirectCount + 1);
          }
        }
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const options: RequestInit = {
          method,
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: body ? JSON.stringify(body) : undefined
        };
        const res = await fetch(url, options);
        clearTimeout(timeoutId);
        response = {
          status: res.status,
          data: await res.json(),
          ok: res.ok
        };
      }

      this.syncingCount = Math.max(0, this.syncingCount - 1);
      if (this.syncingCount === 0) this.notify('sync_status', false);

      if (response.status >= 200 && response.status < 300) {
        if (method === 'GET') {
           this.apiCache[endpoint] = { data: response.data, ts: Date.now() };
        }
        return response.data;
      }
      return null;
    } catch (e: any) {
      this.syncingCount = Math.max(0, this.syncingCount - 1);
      if (this.syncingCount === 0) this.notify('sync_status', false);
      console.warn(`API call to ${endpoint} failed:`, e);
      return null;
    }
  }

  private async fetchCollection(key: keyof State, collectionName: string, queryParams = "") {
    // If queryParams has a q=, we should ensure it's encoded if not already,
    // but usually it's passed already formed.
    const data = await this.apiCall(`/db/${collectionName}${queryParams}`);
    if (data) {
      const cloudData = Array.isArray(data) ? data : [];
      const currentLocal = this.state[key];

      let merged: any;
      if (Array.isArray(currentLocal)) {
         const cloudIds = new Set(cloudData.map((d: any) => d.id));
         const localOnly = currentLocal.filter(item => !cloudIds.has(item.id));
         merged = [...cloudData, ...localOnly];
      } else {
         merged = { ...currentLocal };
         cloudData.forEach((d: any) => {
            if (key === 'schedules') {
               const schedKey = `${d.campus}_${d.niveau}`;
               merged[schedKey] = d;
            } else {
               merged[d.id] = d;
            }
         });
      }

      (this.state[key] as any) = merged;

      // Sync currentUser if it's in the users collection
      if (key === 'users' && this.state.currentUser) {
        const updatedSelf = (merged as User[]).find(u => u.id === this.state.currentUser!.id);
        if (updatedSelf) {
          // Merge but keep local password if cloud doesn't have it (for mock auth)
          this.state.currentUser = { ...this.state.currentUser, ...updatedSelf };
          this.notify('auth', this.state.currentUser);
        }
      }

      this.save();
      this.notify(key as string, merged);

      Object.keys(this.listeners).forEach(subKey => {
         if (subKey.startsWith(`${key as string}_`)) {
            this.notify(subKey, merged);
         }
      });
    }
  }

  // --- CUSTOM AUTH ---

  async login(email: string, password: string): Promise<User | null> {
    const q = encodeURIComponent(JSON.stringify({ email, password }));
    const data = await this.apiCall(`/db/users?q=${q}`);
    if (data && Array.isArray(data) && data.length > 0) {
       const user = data[0] as User;
       this.setCurrentUser(user);
       return user;
    }
    // Check local fallback (mock accounts)
    const local = this.state.users.find(u => u.email === email && u.password === password);
    if (local) {
       this.setCurrentUser(local);
       return local;
    }
    return null;
  }

  async register(user: User): Promise<User | null> {
    // Ensure photo is handled if present
    const res = await this.apiCall('/db/users', 'POST', user);
    if (res) {
       const finalUser = { ...user, ...res };
       this.setCurrentUser(finalUser);
       return finalUser;
    }
    return null;
  }

  logout() {
    this.setCurrentUser(null);
  }

  async resetPassword(email: string): Promise<boolean> {
     const q = encodeURIComponent(JSON.stringify({ email }));
     const data = await this.apiCall(`/db/users?q=${q}`);
     if (data && Array.isArray(data) && data.length > 0) {
        // Simulated success
        return true;
     }
     return false;
  }

  getAdminCode() { return ADMIN_CODE; }
  getProfPass() { return PROF_PASS; }

  // --- STORE ACCESS ---

  getCurrentUser() { return this.state.currentUser; }
  setCurrentUser(user: User | null) {
    this.state.currentUser = user;
    this.save();
    this.notify('auth', user);
  }

  subscribe(cb: (u: User | null) => void) { return this.subscribeAuth(cb); }

  subscribeAuth(cb: (u: User | null) => void) {
    if (!this.listeners['auth']) this.listeners['auth'] = [];
    this.listeners['auth'].push(cb);
    cb(this.state.currentUser);
    return () => { this.listeners['auth'] = this.listeners['auth']?.filter(l => l !== cb); };
  }

  subscribeUsers(cb: (us: User[]) => void) {
    if (!this.listeners['users']) this.listeners['users'] = [];
    this.listeners['users'].push(cb);
    cb(this.state.users);
    this.fetchCollection('users', 'users');
    return () => { this.listeners['users'] = this.listeners['users']?.filter(l => l !== cb); };
  }

  subscribeLessons(filter: { niveau?: string }, cb: (ls: Lesson[]) => void) {
    const subKey = filter.niveau ? `lessons_${filter.niveau}` : 'lessons';
    if (!this.listeners[subKey]) this.listeners[subKey] = [];

    const wrapper = (data: Lesson[]) => {
      const filtered = filter.niveau ? data.filter((l: any) => l.niveau === filter.niveau) : data;
      cb(filtered);
    };

    this.listeners[subKey].push(wrapper);
    wrapper(this.state.lessons);
    this.fetchCollection('lessons', 'lessons');
    return () => { this.listeners[subKey] = this.listeners[subKey]?.filter(l => l !== wrapper); };
  }

  subscribeAssignments(filter: { niveau?: string }, cb: (as: Assignment[]) => void) {
    const subKey = filter.niveau ? `assignments_${filter.niveau}` : 'assignments';
    if (!this.listeners[subKey]) this.listeners[subKey] = [];

    const wrapper = (data: Assignment[]) => {
      const filtered = filter.niveau ? data.filter((a: any) => a.niveau === filter.niveau) : data;
      cb(filtered);
    };

    this.listeners[subKey].push(wrapper);
    wrapper(this.state.assignments);
    this.fetchCollection('assignments', 'assignments');
    return () => { this.listeners[subKey] = this.listeners[subKey]?.filter(l => l !== wrapper); };
  }

  subscribeAnnouncements(cb: (as: Announcement[]) => void) {
    if (!this.listeners['announcements']) this.listeners['announcements'] = [];
    this.listeners['announcements'].push(cb);
    cb(this.state.announcements);
    this.fetchCollection('announcements', 'announcements');
    return () => { this.listeners['announcements'] = this.listeners['announcements']?.filter(l => l !== cb); };
  }

  subscribeGrades(studentId: string, cb: (gs: Grade[]) => void) {
    const subKey = `grades_${studentId}`;
    if (!this.listeners[subKey]) this.listeners[subKey] = [];
    this.listeners[subKey].push(cb);
    const applyFilter = (data: Grade[]) => {
      cb(data.filter((g: any) => g.studentId === studentId));
    };
    applyFilter(this.state.grades);
    this.fetchCollection('grades', 'grades', `?q={"studentId":"${studentId}"}`);
    return () => { this.listeners[subKey] = this.listeners[subKey]?.filter(l => l !== cb); };
  }

  subscribeLatestSchedule(campus: string, niveau: string, cb: (s: StructuredSchedule | null) => void) {
    const sKey = campus && niveau ? `${campus}_${niveau}` : 'all';
    const subKey = `schedule_${sKey}`;
    if (!this.listeners[subKey]) this.listeners[subKey] = [];
    this.listeners[subKey].push(cb);

    if (sKey === 'all') {
       cb(this.state.schedules as any);
       this.fetchCollection('schedules', 'schedules');
    } else {
       cb(this.state.schedules[sKey] || null);
       this.fetchCollection('schedules', 'schedules', `?q={"campus":"${campus}","niveau":"${niveau}"}`);
    }
    return () => { this.listeners[subKey] = this.listeners[subKey]?.filter(l => l !== cb); };
  }

  subscribeMessages(cb: (ms: ChatMessage[]) => void) {
    if (!this.listeners['messages']) this.listeners['messages'] = [];
    this.listeners['messages'].push(cb);
    cb(this.state.messages);
    this.fetchChatMessages();
    return () => { this.listeners['messages'] = this.listeners['messages']?.filter(l => l !== cb); };
  }

  subscribeSyncStatus(cb: (isSyncing: boolean) => void) {
    if (!this.listeners['sync_status']) this.listeners['sync_status'] = [];
    this.listeners['sync_status'].push(cb);
    cb(this.syncingCount > 0);
    return () => { this.listeners['sync_status'] = this.listeners['sync_status']?.filter(l => l !== cb); };
  }

  subscribeReminders(cb: (rs: Reminder[]) => void) {
    if (!this.listeners['reminders']) this.listeners['reminders'] = [];
    this.listeners['reminders'].push(cb);
    cb(this.state.reminders);
    return () => { this.listeners['reminders'] = this.listeners['reminders']?.filter(l => l !== cb); };
  }

  subscribeSubmissions(assignmentId?: string, cb?: (ss: Submission[]) => void) {
    const key = assignmentId ? `submissions_${assignmentId}` : 'submissions';
    if (!this.listeners[key]) this.listeners[key] = [];
    if (cb) this.listeners[key].push(cb);

    const filter = (all: Submission[]) => {
      if (assignmentId) return all.filter(s => s.assignmentId === assignmentId);
      return all;
    };

    if (cb) cb(filter(this.state.submissions));
    this.fetchCollection('submissions', 'submissions');
    return () => { if (cb) this.listeners[key] = this.listeners[key]?.filter(l => l !== cb); };
  }

  // --- ACTIONS ---

  async addUser(user: User) {
    this.state.users = [user, ...this.state.users.filter(u => u.id !== user.id)];
    this.save();
    this.notify('users', this.state.users);
    const existing = await this.apiCall(`/db/users?q={"id":"${user.id}"}`);
    if (existing && Array.isArray(existing) && existing.length > 0) {
       return await this.apiCall(`/db/users/${existing[0]._id}`, 'PATCH', user);
    } else {
       return await this.apiCall('/db/users', 'POST', user);
    }
  }

  async addLesson(lesson: Lesson) {
    this.state.lessons = [lesson, ...this.state.lessons.filter(l => l.id !== lesson.id)];
    this.save();
    this.notify('lessons', this.state.lessons);
    await this.apiCall('/db/lessons', 'POST', lesson);
  }

  async deleteLesson(id: string) {
    const item = this.state.lessons.find(x => x.id === id);
    this.state.lessons = this.state.lessons.filter(x => x.id !== id);
    this.save();
    this.notify('lessons', this.state.lessons);
    if (item?._id) {
       await this.apiCall(`/db/lessons/${item._id}`, 'DELETE');
    } else {
       const q = encodeURIComponent(JSON.stringify({ id }));
       const existing = await this.apiCall(`/db/lessons?q=${q}`);
       if (existing && Array.isArray(existing) && existing.length > 0) {
          await this.apiCall(`/db/lessons/${existing[0]._id}`, 'DELETE');
       }
    }
  }

  async addAssignment(assignment: Assignment) {
    this.state.assignments = [assignment, ...this.state.assignments.filter(a => a.id !== assignment.id)];
    this.save();
    this.notify('assignments', this.state.assignments);
    await this.apiCall('/db/assignments', 'POST', assignment);
  }

  async deleteAssignment(id: string) {
    const item = this.state.assignments.find(x => x.id === id);
    this.state.assignments = this.state.assignments.filter(x => x.id !== id);
    this.save();
    this.notify('assignments', this.state.assignments);
    if (item?._id) {
       await this.apiCall(`/db/assignments/${item._id}`, 'DELETE');
    } else {
       const q = encodeURIComponent(JSON.stringify({ id }));
       const existing = await this.apiCall(`/db/assignments?q=${q}`);
       if (existing && Array.isArray(existing) && existing.length > 0) {
          await this.apiCall(`/db/assignments/${existing[0]._id}`, 'DELETE');
       }
    }
  }

  async addAnnouncement(ann: Announcement) {
    this.state.announcements = [ann, ...this.state.announcements];
    this.save();
    this.notify('announcements', this.state.announcements);
    await this.apiCall('/db/announcements', 'POST', ann);
  }

  async deleteAnnouncement(id: string) {
    const ann = this.state.announcements.find(a => a.id === id);
    this.state.announcements = this.state.announcements.filter(a => a.id !== id);
    this.save();
    this.notify('announcements', this.state.announcements);
    if (ann?._id) {
       await this.apiCall(`/db/announcements/${ann._id}`, 'DELETE');
    } else {
       const q = encodeURIComponent(JSON.stringify({ id }));
       const existing = await this.apiCall(`/db/announcements?q=${q}`);
       if (existing && Array.isArray(existing) && existing.length > 0) {
          await this.apiCall(`/db/announcements/${existing[0]._id}`, 'DELETE');
       }
    }
  }

  async addGrade(grade: Grade) {
    this.state.grades = [grade, ...this.state.grades];
    this.save();
    this.notify('grades', this.state.grades);
    await this.apiCall('/db/grades', 'POST', grade);
  }

  async deleteGrade(id: string) {
    const item = this.state.grades.find(x => x.id === id);
    this.state.grades = this.state.grades.filter(x => x.id !== id);
    this.save();
    this.notify('grades', this.state.grades);
    if (item?._id) {
       await this.apiCall(`/db/grades/${item._id}`, 'DELETE');
    } else {
       const q = encodeURIComponent(JSON.stringify({ id }));
       const existing = await this.apiCall(`/db/grades?q=${q}`);
       if (existing && Array.isArray(existing) && existing.length > 0) {
          await this.apiCall(`/db/grades/${existing[0]._id}`, 'DELETE');
       }
    }
  }

  async updateUser(user: User) {
    this.state.users = this.state.users.map(u => u.id === user.id ? user : u);
    if (this.state.currentUser && this.state.currentUser.id === user.id) {
       this.state.currentUser = { ...this.state.currentUser, ...user };
    }
    this.save();
    this.notify('users', this.state.users);
    this.notify('auth', this.state.currentUser);

    // Also update cloud immediately if _id exists
    const targetId = user._id;
    if (targetId) {
       await this.apiCall(`/db/users/${targetId}`, 'PATCH', user);
    } else {
       const q = encodeURIComponent(JSON.stringify({ id: user.id }));
       const existing = await this.apiCall(`/db/users?q=${q}`);
       if (existing && Array.isArray(existing) && existing.length > 0) {
          await this.apiCall(`/db/users/${existing[0]._id}`, 'PATCH', user);
       }
    }
  }

  async deleteUser(id: string) {
    const userToDelete = this.state.users.find(u => u.id === id);
    this.state.users = this.state.users.filter(u => u.id !== id);
    this.save();
    this.notify('users', this.state.users);
    if (userToDelete?._id) {
       await this.apiCall(`/db/users/${userToDelete._id}`, 'DELETE');
    } else {
       const q = encodeURIComponent(JSON.stringify({ id }));
       const existing = await this.apiCall(`/db/users?q=${q}`);
       if (existing && Array.isArray(existing) && existing.length > 0) {
          await this.apiCall(`/db/users/${existing[0]._id}`, 'DELETE');
       }
    }
  }

  async addSubmission(s: Submission) {
    this.state.submissions = [s, ...this.state.submissions.filter(it => it.id !== s.id)];
    this.save();
    this.notify('submissions', this.state.submissions);
    await this.apiCall('/db/submissions', 'POST', s);
  }

  async updateSubmission(s: Submission) {
    this.state.submissions = this.state.submissions.map(it => it.id === s.id ? s : it);
    this.save();
    this.notify('submissions', this.state.submissions);

    const existing = await this.apiCall(`/db/submissions?q={"id":"${s.id}"}`);
    if (existing && Array.isArray(existing) && existing.length > 0) {
       await this.apiCall(`/db/submissions/${existing[0]._id}`, 'PATCH', s);
    }
  }

  async addSchedule(schedule: StructuredSchedule) {
    const q = encodeURIComponent(JSON.stringify({ campus: schedule.campus, niveau: schedule.niveau }));
    const existing = await this.apiCall(`/db/schedules?q=${q}`);
    if (existing && Array.isArray(existing) && existing.length > 0) {
       await this.apiCall(`/db/schedules/${existing[0]._id}`, 'PATCH', schedule);
    } else {
       await this.apiCall('/db/schedules', 'POST', schedule);
    }
    this.state.schedules[`${schedule.campus}_${schedule.niveau}`] = schedule;
    this.save();
    this.notify('schedules', this.state.schedules);
  }

  async deleteSchedule(id: string) {
    await this.apiCall(`/db/schedules/${id}`, 'DELETE');
    this.fetchCollection('schedules', 'schedules');
  }

  // --- CHAT ---
  async sendMessage(text: string, replyTo?: { senderName: string, text: string }) {
    if (!this.state.currentUser) return;
    const msg: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: this.state.currentUser.id,
      senderName: this.state.currentUser.fullName,
      senderPhoto: this.state.currentUser.photo,
      text,
      replyTo,
      timestamp: new Date().toISOString(),
      filiere: this.state.currentUser.filiere,
      niveau: this.state.currentUser.niveau
    };
    this.state.messages = [...this.state.messages, msg];
    this.notify('messages', this.state.messages);
    await this.apiCall('/db/messages', 'POST', msg);
  }

  // --- REMINDERS & NOTIFICATIONS ---
  async addReminder(r: Reminder) {
    this.state.reminders = [...this.state.reminders, r];
    this.save();
    this.notify('reminders', this.state.reminders);
    this.scheduleNotification(r);
  }

  async updateReminder(r: Reminder) {
    this.state.reminders = this.state.reminders.map(it => it.id === r.id ? r : it);
    this.save();
    this.notify('reminders', this.state.reminders);
    if (!r.completed) this.scheduleNotification(r);
    else this.cancelNotification(r.id);
  }

  async deleteReminder(id: string) {
    this.state.reminders = this.state.reminders.filter(it => it.id !== id);
    this.save();
    this.notify('reminders', this.state.reminders);
    this.cancelNotification(id);
  }

  private async scheduleNotification(r: Reminder) {
    if (Capacitor.isNativePlatform()) {
      const scheduleDate = new Date(`${r.date}T${r.time}`);
      if (scheduleDate > new Date()) {
        await LocalNotifications.schedule({
          notifications: [{
            id: parseInt(r.id.replace(/\D/g, '').substr(0, 9)) || Math.floor(Math.random() * 1000000),
            title: r.isAlarm ? `ALERTE PROGRAMME : ${r.subject}` : `Rappel GSI : ${r.subject}`,
            body: r.title,
            schedule: { at: scheduleDate },
            sound: r.isAlarm ? 'alarm.wav' : 'default',
            extra: { reminderId: r.id }
          }]
        });
      }
    }
  }

  private async cancelNotification(id: string) {
     if (Capacitor.isNativePlatform()) {
        const nid = parseInt(id.replace(/\D/g, '').substr(0, 9));
        if (nid) await LocalNotifications.cancel({ notifications: [{ id: nid }] });
     }
  }

  // --- FILES ENGINE ---

  getAbsoluteUrl(url: string | undefined): string {
    if (!url || url === "undefined" || url === "null") return "";
    // Robust URL handling: if it's already absolute, return as is.
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
       return url;
    }

    // Pour les chemins relatifs, on préfixe simplement avec MEDIA_BASE
    // On s'assure qu'il n'y a pas de double slash
    const base = MEDIA_BASE.endsWith('/') ? MEDIA_BASE.slice(0, -1) : MEDIA_BASE;
    const path = url.startsWith('/') ? url : `/${url}`;

    return `${base}${path}`;
  }

  getStudentQrData(user: User): string {
    const info = {
      m: user.matricule || "GSI-TEMP",
      n: user.fullName,
      c: user.campus,
      f: user.filiere,
      l: user.niveau,
      v: `https://groupegsi.mg/presence?id=${user.id}`
    };
    return JSON.stringify(info);
  }

  async uploadFile(file: File, path: string, onProgress?: (p: number) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      // Ensure we pass the intended path if the server supports it
      formData.append('file', file, file.name);
      formData.append('path', path);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress((e.loaded / e.total) * 100);
        }
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            // Enhanced robustness for different API response formats
            const url = response.viewUrl || response.downloadUrl || response.url || response.path || (response.data && response.data.url);
            if (url) {
              resolve(url);
            } else {
              reject(new Error("Upload succeeded but no URL returned in response"));
            }
          } catch (e) {
            reject(new Error("Failed to parse upload response: " + xhr.responseText));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
        }
      });
      xhr.addEventListener('error', () => reject(new Error("Network error during upload")));
      xhr.open('POST', `${API_BASE}/upload`);
      xhr.send(formData);
    });
  }

  async downloadPackFile(url: string, fileName: string, lessonId: string, redirectCount = 0): Promise<string> {
    if (redirectCount > 3) throw new Error("Trop de redirections.");

    try {
      const absoluteUrl = this.getAbsoluteUrl(url);
      const safeFileName = fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
      const path = `gsi_packs/${lessonId}_${safeFileName}`;

      try {
        await Filesystem.stat({ path, directory: Directory.Data });
        return path;
      } catch (e) {}

      if (typeof window === 'undefined' || !window.navigator.onLine) {
         throw new Error("Connexion requise pour le téléchargement.");
      }

      let base64Data = "";
      let contentType = "";

      if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.get({
          url: absoluteUrl,
          responseType: 'blob'
        });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers['Location'] || response.headers['location'];
          if (location) return this.downloadPackFile(location, fileName, lessonId, redirectCount + 1);
        }

        if (response.status !== 200) throw new Error(`Erreur serveur (${response.status})`);
        base64Data = response.data; // CapacitorHttp with responseType: 'blob' returns base64 on native
        contentType = response.headers['Content-Type'] || response.headers['content-type'] || "";
      } else {
        const response = await fetch(absoluteUrl);
        if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);
        contentType = response.headers.get('content-type') || "";
        const blob = await response.blob();
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const b64 = (reader.result as string).split(',')[1];
            if (b64) resolve(b64);
            else reject(new Error("Échec Base64"));
          };
          reader.readAsDataURL(blob);
        });
      }

      await Filesystem.writeFile({
        path,
        data: base64Data,
        directory: Directory.Data,
        recursive: true
      });

      this.setDownloaded(lessonId, true);
      this.saveProgress(lessonId, { localPath: path, mimeType: contentType });
      return path;
    } catch (e: any) {
      console.error("Pack download failed:", e);
      throw e;
    }
  }

  async openPackFile(lessonId: string, url: string): Promise<void> {
    const absoluteUrl = this.getAbsoluteUrl(url);
    const lowUrl = absoluteUrl.toLowerCase().split('?')[0];
    const progress = this.getProgress(lessonId);

    let type: 'pdf' | 'docx' | 'video' | 'image' = 'pdf';
    const mime = (progress?.mimeType || "").toLowerCase();

    if (mime.includes('pdf') || lowUrl.endsWith('.pdf')) type = 'pdf';
    else if (mime.includes('word') || mime.includes('docx') || lowUrl.endsWith('.docx')) type = 'docx';
    else if (mime.includes('video') || lowUrl.match(/\.(mp4|mov|webm|avi|mkv|3gp|flv|wmv)$/)) type = 'video';
    else if (mime.includes('image') || lowUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) type = 'image';
    else {
      if (lowUrl.includes('.pdf')) type = 'pdf';
      else if (lowUrl.includes('.docx')) type = 'docx';
      else if (lowUrl.includes('.mp4')) type = 'video';
    }

    const dispatchViewer = (targetUrl: string) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gsi-open-viewer', {
          detail: { url: targetUrl, type, originalUrl: absoluteUrl }
        }));
      }
    };

    try {
      // 1. Check for cached/downloaded file
      if (progress?.localPath) {
        try {
          const path = progress.localPath;
          const stats = await Filesystem.stat({ path, directory: Directory.Data });

          // Debug trace for local file
          console.log(`GSIStore: Found local file at ${path}, size: ${stats.size}`);

          // FOR MULTIMEDIA: Use file URI directly (better for large videos/images)
          if (type === 'video' || type === 'image') {
             const fileUri = await Filesystem.getUri({ path, directory: Directory.Data });
             dispatchViewer(Capacitor.convertFileSrc(fileUri.uri));
             return;
          }

          // FOR DOCUMENTS: Use Blob (better for Render Engines like PDF.js/Mammoth)
          const file = await Filesystem.readFile({ path, directory: Directory.Data });
          const dataStr = typeof file.data === 'string' ? file.data : '';

          let actualMime = progress.mimeType || mime;
          if (!actualMime) {
             actualMime = type === 'pdf' ? 'application/pdf' :
                          type === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                          type === 'video' ? 'video/mp4' : 'image/jpeg';
          }

          const blob = this.b64toBlob(dataStr, actualMime);
          const blobUrl = URL.createObjectURL(blob);
          console.log(`GSIStore: Dispatched Blob URL for ${type}`);
          dispatchViewer(blobUrl);
          return;
        } catch (e) {
          console.warn("GSIStore: Local file check failed, re-downloading...", e);
          this.setDownloaded(lessonId, false);
        }
      }

      // 2. If not cached, download then open
      if (window.navigator.onLine) {
        const fileName = absoluteUrl.split('/').pop() || (type === 'pdf' ? 'doc.pdf' : type === 'docx' ? 'doc.docx' : 'video.mp4');
        const path = await this.downloadPackFile(absoluteUrl, fileName, lessonId);

        // RECURSIVE CALL to use the newly cached logic
        return this.openPackFile(lessonId, url);
      } else {
        // Stream directly if online (fallback)
        dispatchViewer(absoluteUrl);
      }
    } catch (e: any) {
      console.error("Open pack failed:", e);
      dispatchViewer(absoluteUrl);
    }
  }

  private b64toBlob(b64Data: string, contentType = '', sliceSize = 512) {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  }

  async getUser(id: string, forceCloud = false): Promise<User | null> {
    const local = this.state.users.find(u => u.id === id);
    if (local && !forceCloud) return local;
    try {
      const q = encodeURIComponent(JSON.stringify({ id }));
      const data = await this.apiCall(`/db/users?q=${q}`);
      if (data && data.length > 0) {
        const userData = data[0] as User;
        this.state.users = [userData, ...this.state.users.filter(u => u.id !== id)];
        this.save();
        return userData;
      }
    } catch (e) {
      console.error("Error fetching user from Custom API:", e);
    }
    return local || null;
  }

  // --- CACHE & UTILS ---
  async getUsers() { return this.state.users; }
  async getLessons() { return this.state.lessons; }
  async getAssignments() { return this.state.assignments; }
  async getGrades() { return this.state.grades; }
  async getAnnouncements() { return this.state.announcements; }
  getCache<T>(key: string): T | null { return (this.state as any)[key] || null; }
  setCache(key: string, data: any) { (this.state as any)[key] = data; this.save(); }

  saveProgress(id: string, p: any) {
    const all = JSON.parse(localStorage.getItem('gsi_progress') || '{}');
    all[id] = { ...(all[id] || {}), ...p, ts: Date.now() };
    localStorage.setItem('gsi_progress', JSON.stringify(all));
    this.notify('progress', all);
  }

  toggleLessonCompleted(id: string) {
     const p = this.getProgress(id) || {};
     this.saveProgress(id, { completed: !p.completed });
  }
  getProgress(id: string) { return JSON.parse(localStorage.getItem('gsi_progress') || '{}')[id] || null; }
  setDownloaded(id: string, s = true) {
    const all = JSON.parse(localStorage.getItem('gsi_downloaded') || '{}');
    all[id] = s;
    localStorage.setItem('gsi_downloaded', JSON.stringify(all));
  }
  isDownloaded(id: string) { return !!JSON.parse(localStorage.getItem('gsi_downloaded') || '{}')[id]; }
}

export const GSIStore = new GSIStoreClass();
