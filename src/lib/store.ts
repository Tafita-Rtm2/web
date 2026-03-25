"use client";

import { Filesystem, Directory } from '@capacitor/filesystem';
import { Browser } from '@capacitor/browser';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { toast } from 'sonner';

// --- CONFIGURATION ---
let API_BASE = "https://groupegsi.mg/rtmggmg/api";
let MEDIA_BASE = "https://groupegsi.mg/rtmggmg";

let ADMIN_CODE = "";
let PROF_PASS = "";
let AI_CONFIG = {
  apiKey: "",
  prompts: {} as Record<string, string> // campus_subject -> prompt
};

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
export interface Submission { id: string; assignmentId: string; studentId: string; studentName: string; date: string; file: string; score?: number; feedback?: string; _id?: string; campus?: string; filiere?: string; niveau?: string; }
export interface Grade { id: string; studentId: string; studentName: string; subject: string; score: number; maxScore: number; date: string; niveau: string; filiere: string; _id?: string; }
export interface Announcement { id: string; title: string; message: string; date: string; author: string; type?: 'info' | 'convocation'; targetUserId?: string; campus?: string[]; filiere?: string[]; niveau?: string; _id?: string; }

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  image?: string;
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
  campusInfo?: string;
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
  aiMessages: any[];
  reminders: Reminder[];
  deletedAnnouncementIds: string[];
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
  aiMessages: [],
  reminders: [],
  deletedAnnouncementIds: []
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
      this.initWebConfig();
      // Wait a bit before syncing to let UI render first
      setTimeout(() => this.startGlobalSync(), 2000);
      window.addEventListener('beforeunload', () => this.saveImmediate());
    }
  }

  private async initWebConfig() {
    if (Capacitor.isNativePlatform()) return;
    try {
      const res = await fetch('/apk/api/config');
      if (res.ok) {
        const config = await res.json();
        if (config.API_BASE) API_BASE = config.API_BASE;
        if (config.MEDIA_BASE) MEDIA_BASE = config.MEDIA_BASE;
      }
    } catch (e) {}
  }

  private hydrate() {
    try {
      const saved = localStorage.getItem('gsi_v8_master');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          this.state = {
            ...initialState,
            ...parsed,
            users: Array.isArray(parsed.users) ? parsed.users : [],
            lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
            assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
            announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
            schedules: (parsed.schedules && typeof parsed.schedules === 'object') ? parsed.schedules : {}
          };
        }
      }
      if (!Array.isArray(this.state.users) || this.state.users.length === 0) {
        this.state.users = [];
        this.generateMockData();
      }
    } catch (e) {
      this.state = { ...initialState };
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
        { id: 'l1', title: 'Guide GSI Agent Assistant', description: 'Bienvenue dans votre espace personnel.', subject: 'Général', niveau: 'L1', filiere: [], campus: [], date: new Date().toISOString(), files: [] }
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
      } catch (e) {}
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
    this.syncAll().then(() => {
       this.autoDownloadEssentials();
    });

    this.syncRemoteConfig();

    setInterval(() => {
       this.syncAll();
    }, 30000);

    setInterval(() => {
       if (this.state.currentUser) {
         this.fetchChatMessages();
       }
    }, 8000);

    setInterval(() => {
      if (this.state.currentUser) {
        this.fetchCollection('announcements', 'announcements');
      }
    }, 20000);
  }

  private async autoDownloadEssentials() {
     if (!this.state.currentUser) return;
     const { campus, niveau } = this.state.currentUser;

     const sched = this.state.schedules[`${campus}_${niveau}`];
     if (sched && (sched.fileUrl || sched.url)) {
        try {
           await this.downloadPackFile(sched.fileUrl || sched.url!, `Schedule_${campus}_${niveau}.pdf`, sched.id);
        } catch (e) {}
     }
  }

  async syncAll() {
     await Promise.all([
       this.fetchCollection('users', 'users'),
       this.syncRemoteConfig(),
       this.fetchCollection('lessons', 'lessons'),
       this.fetchCollection('assignments', 'assignments'),
       this.fetchCollection('announcements', 'announcements'),
       this.fetchCollection('grades', 'grades'),
       this.fetchCollection('schedules', 'schedules'),
       this.fetchChatMessages()
     ]);
     this.cleanOfflineFiles();
  }

  private async cleanOfflineFiles() {
     let progress: any = {};
     let downloaded: any = {};
     try {
        progress = JSON.parse(localStorage.getItem('gsi_progress') || '{}');
        downloaded = JSON.parse(localStorage.getItem('gsi_downloaded') || '{}');
     } catch (e) {}

     const cloudLessonIds = new Set((this.state.lessons || []).map(l => l && l.id).filter(Boolean));
     const cloudAssignmentIds = new Set(this.state.assignments.map(a => a.id));

     for (const id in downloaded) {
        if (!cloudLessonIds.has(id) && !cloudAssignmentIds.has(id)) {
           if (progress[id]?.localPath) {
              try {
                 await Filesystem.deleteFile({ path: progress[id].localPath, directory: Directory.Data });
              } catch (e) {}
           }
           delete downloaded[id];
           delete progress[id];
        }
     }
     localStorage.setItem('gsi_downloaded', JSON.stringify(downloaded));
     localStorage.setItem('gsi_progress', JSON.stringify(progress));
  }

  private async fetchChatMessages() {
    if (!this.state.currentUser) return;
    const { filiere, niveau } = this.state.currentUser;
    const q = encodeURIComponent(JSON.stringify({ filiere, niveau }));
    const data = await this.apiCall(`/db/messages?q=${q}&s={"timestamp":-1}&l=60`);
    if (data && Array.isArray(data)) {
      const newMessages = data.reverse();
      if (JSON.stringify(newMessages) !== JSON.stringify(this.state.messages)) {
        this.state.messages = newMessages;
        this.notify('messages', this.state.messages);
      }
    }
  }

  // --- API HELPERS ---

  private async apiCall(endpoint: string, method = 'GET', body?: any, redirectCount = 0): Promise<any> {
    if (typeof window !== 'undefined' && !window.navigator.onLine && method === 'GET') {
       return this.apiCache[endpoint]?.data || null;
    }

    if (redirectCount > 3) return null;

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

      if (method === 'GET' && this.apiCache[endpoint]) return this.apiCache[endpoint].data;

      return null;
    } catch (e: any) {
      this.syncingCount = Math.max(0, this.syncingCount - 1);
      if (this.syncingCount === 0) this.notify('sync_status', false);
      return null;
    }
  }

  private async fetchCollection(key: keyof State, collectionName: string, queryParams = "") {
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
       this.notify(key as string, this.state[key]);
       return;
    }

    const data = await this.apiCall(`/db/${collectionName}${queryParams}`);
    if (data) {
      const cloudData = Array.isArray(data) ? data : [];
      const currentLocal = this.state[key];

      let merged: any;

      // HARD DELETE SYNC: Students consume lessons, assignments, announcements, grades.
      // We overwrite with cloud data to propagate deletions.
      const isConsumable = ['lessons', 'assignments', 'announcements', 'grades'].includes(key as string);

      if (isConsumable) {
         merged = cloudData;
      } else if (Array.isArray(currentLocal)) {
         const cloudIds = new Set(cloudData.map((d: any) => d.id));
         const localOnly = (currentLocal as any[]).filter(item => item && item.id && !cloudIds.has(item.id));
         merged = [...cloudData, ...localOnly];
      } else {
         merged = { ...(currentLocal || {}) };
         cloudData.forEach((d: any) => {
            if (d) {
               if (key === 'schedules' && d.campus && d.niveau) {
                  const schedKey = `${d.campus}_${d.niveau}`;
                  (merged as any)[schedKey] = d;
               } else if (d.id) {
                  (merged as any)[d.id] = d;
               }
            }
         });
      }

      (this.state[key] as any) = merged;

      if (key === 'users' && this.state.currentUser) {
        const updatedSelf = (merged as User[]).find(u => u.id === this.state.currentUser!.id);
        if (updatedSelf) {
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

  private async syncRemoteConfig() {
    try {
      const data = await this.apiCall('/db/system_config');
      if (data && Array.isArray(data) && data.length > 0) {
        const config = data[0];
        if (config.ADMIN_CODE) ADMIN_CODE = config.ADMIN_CODE;
        if (config.PROF_PASS) PROF_PASS = config.PROF_PASS;
        if (config.AI_CONFIG) AI_CONFIG = config.AI_CONFIG;
      }
    } catch (e) {}
  }

  getAdminCode() { return ADMIN_CODE; }
  getProfPass() { return PROF_PASS; }
  getAIConfig() { return AI_CONFIG; }

  async updateAIConfig(config: typeof AI_CONFIG) {
     AI_CONFIG = config;
     const existing = await this.apiCall('/db/system_config');
     if (existing && Array.isArray(existing) && existing.length > 0) {
        await this.apiCall(`/db/system_config/${existing[0]._id}`, 'PATCH', { AI_CONFIG });
     } else {
        await this.apiCall('/db/system_config', 'POST', { AI_CONFIG });
     }
  }

  async login(email: string, password: string): Promise<User | null> {
    const q = encodeURIComponent(JSON.stringify({ email, password }));
    const data = await this.apiCall(`/db/users?q=${q}`);
    if (data && Array.isArray(data) && data.length > 0) {
       const user = data[0] as User;
       this.setCurrentUser(user);
       return user;
    }
    const local = this.state.users.find(u => u.email === email && u.password === password);
    if (local) {
       this.setCurrentUser(local);
       return local;
    }
    return null;
  }

  async register(user: User): Promise<User | null> {
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
        return true;
     }
     return false;
  }

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

    const applyLocalDelete = (data: Announcement[]) => {
      const deleted = this.state.deletedAnnouncementIds || [];
      cb(data.filter(a => !deleted.includes(a.id)));
    };

    applyLocalDelete(this.state.announcements);
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

  subscribeAiMessages(cb: (ms: any[]) => void) {
    if (!this.listeners['ai_messages']) this.listeners['ai_messages'] = [];
    this.listeners['ai_messages'].push(cb);
    cb(this.state.aiMessages || []);
    return () => { this.listeners['ai_messages'] = this.listeners['ai_messages']?.filter(l => l !== cb); };
  }

  setAiMessages(msgs: any[]) {
    this.state.aiMessages = msgs;
    this.save();
    this.notify('ai_messages', msgs);
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
    const user = this.state.currentUser;
    // If student, just hide it locally
    if (user?.role === 'student') {
       this.state.deletedAnnouncementIds = [...(this.state.deletedAnnouncementIds || []), id];
       this.save();
       this.notify('announcements', this.state.announcements);
       return;
    }

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
    if (typeof url !== 'string' || !url || url === "undefined" || url === "null") return "";

    if (url.startsWith('data:') || url.startsWith('blob:')) return url;

    if (url.startsWith('http://') || url.startsWith('https://')) {
       if (url.includes('groupegsi.mg') && !url.includes('/api/')) {
          return url.replace('rtmggmg/', 'rtmggmg/api/');
       }
       return url;
    }

    if (url.includes(' ') && !url.startsWith('/') && !url.startsWith('files/') && !url.startsWith('api/') && url.length > 20) {
       return url;
    }

    let clean = url;
    clean = clean.replace(/^\/+/, '');
    clean = clean.replace(/^rtmggmg\//, '');
    clean = clean.replace(/^api\//, '');
    clean = clean.replace(/^\/+/, '');

    if (!clean.includes('files/view/') && !clean.includes('http')) {
       if (!clean.includes('/') && clean.length > 5) {
         clean = `files/view/${clean}`;
       }
    }

    const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
    return `${base}/${clean}`;
  }

  getMediaUrl(url: string | undefined): string {
    if (typeof url !== 'string' || !url) return "";

    if (url.startsWith('blob:') || url.startsWith('data:')) return url;

    const absolute = this.getAbsoluteUrl(url);
    if (!absolute) return "";

    if (Capacitor.isNativePlatform()) return absolute;

    if (absolute.startsWith('http')) {
      return `/apk/api/proxy?url=${encodeURIComponent(absolute)}`;
    }

    return absolute;
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
            const url = response.viewUrl || response.downloadUrl || response.url || response.path || (response.data && response.data.url);
            if (url) resolve(url);
            else reject(new Error("No URL in response"));
          } catch (e) {
            reject(new Error("Failed to parse response"));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
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
        base64Data = response.data;
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

  async openPackFile(lessonId: string, urlOrUrls: string | string[]): Promise<void> {
    const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
    const url = urls[0];
    const lowUrl = (url || "").toLowerCase();

    let type: 'pdf' | 'docx' | 'video' | 'image' | 'text' = 'pdf';

    if (lowUrl.endsWith('.pdf') || lowUrl.includes('/pdf')) type = 'pdf';
    else if (lowUrl.endsWith('.docx') || lowUrl.includes('word')) type = 'docx';
    else if (lowUrl.match(/\.(mp4|mov|webm|avi|mkv|3gp|flv|wmv)$/)) type = 'video';
    else if (lowUrl.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/) || lowUrl.includes('photo') || lowUrl.includes('image')) type = 'image';
    else if (url && (url.includes('files/') || url.includes('api/') || (url.length > 8 && !url.includes(' ') && !url.includes('.')))) {
       type = 'image';
    }
    else if (url && !url.startsWith('http') && !url.startsWith('/') && !url.startsWith('files/') && !url.startsWith('api/')) type = 'text';

    // If multiple images, we keep it as 'image' type but pass the array
    const absoluteUrls = type === 'text' ? urls : urls.map(u => this.getMediaUrl(u));
    const absoluteUrl = absoluteUrls[0];
    const progress = this.getProgress(lessonId);
    const mime = (progress?.mimeType || "").toLowerCase();

    if (mime.includes('pdf')) type = 'pdf';
    else if (mime.includes('word') || mime.includes('docx')) type = 'docx';
    else if (mime.includes('video')) type = 'video';
    else if (mime.includes('image')) type = 'image';

    const dispatchViewer = (targetUrl: string | string[]) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gsi-open-viewer', {
          detail: {
            id: lessonId,
            url: Array.isArray(targetUrl) ? targetUrl[0] : targetUrl,
            urls: Array.isArray(targetUrl) ? targetUrl : [targetUrl],
            type,
            originalUrl: absoluteUrl
          }
        }));
      }
    };

    if (type === 'text') {
       dispatchViewer(url);
       return;
    }

    // For images and videos, we prioritize online playback via proxy as requested by user
    // because "offline download" for these formats on web can be problematic.
    if (!Capacitor.isNativePlatform() && (type === 'video' || type === 'image')) {
       dispatchViewer(absoluteUrls);
       return;
    }

    try {
      if (progress?.localPath) {
        try {
          const path = progress.localPath;
          if (type === 'video' || type === 'image') {
             const fileUri = await Filesystem.getUri({ path, directory: Directory.Data });
             dispatchViewer(Capacitor.convertFileSrc(fileUri.uri));
             return;
          }
          const file = await Filesystem.readFile({ path, directory: Directory.Data });
          const dataStr = typeof file.data === 'string' ? file.data : '';

          let actualMime = progress.mimeType || mime;
          if (!actualMime || actualMime === "undefined") {
             const ext = path.split('.').pop()?.toLowerCase();
             actualMime = ext === 'pdf' ? 'application/pdf' :
                          ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                          ext === 'mp4' ? 'video/mp4' :
                          ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                          ext === 'png' ? 'image/png' :
                          type === 'pdf' ? 'application/pdf' : 'image/jpeg';
          }

          const blob = this.b64toBlob(dataStr, actualMime);
          const blobUrl = URL.createObjectURL(blob);
          dispatchViewer(blobUrl);
          return;
        } catch (e) {
          this.setDownloaded(lessonId, false);
        }
      }

      if (window.navigator.onLine) {
        if (!Capacitor.isNativePlatform() && (type === 'video' || type === 'image')) {
          dispatchViewer(absoluteUrl);
          return;
        }
        const fileName = absoluteUrl.split('/').pop() || (type === 'pdf' ? 'doc.pdf' : type === 'docx' ? 'doc.docx' : 'video.mp4');
        const path = await this.downloadPackFile(absoluteUrl, fileName, lessonId);
        return this.openPackFile(lessonId, url);
      } else {
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

  async getUsers() { return this.state.users; }
  async getLessons() { return this.state.lessons; }
  async getAssignments() { return this.state.assignments; }
  async getGrades() { return this.state.grades; }
  async getAnnouncements() { return this.state.announcements; }
  getCache<T>(key: string): T | null { return (this.state as any)[key] || null; }
  setCache(key: string, data: any) { (this.state as any)[key] = data; this.save(); }

  saveProgress(id: string, p: any) {
    let all: any = {};
    try {
       all = JSON.parse(localStorage.getItem('gsi_progress') || '{}');
    } catch (e) {}
    all[id] = { ...(all[id] || {}), ...p, ts: Date.now() };
    localStorage.setItem('gsi_progress', JSON.stringify(all));
    this.notify('progress', all);
    window.dispatchEvent(new CustomEvent('gsi_progress_updated', { detail: all }));
  }

  toggleLessonCompleted(id: string) {
     const p = this.getProgress(id) || {};
     this.saveProgress(id, { completed: !p.completed });
  }
  getProgress(id: string) {
    try {
      return JSON.parse(localStorage.getItem('gsi_progress') || '{}')[id] || null;
    } catch (e) { return null; }
  }
  setDownloaded(id: string, s = true) {
    let all: any = {};
    try {
      all = JSON.parse(localStorage.getItem('gsi_downloaded') || '{}');
    } catch (e) {}
    all[id] = s;
    localStorage.setItem('gsi_downloaded', JSON.stringify(all));
  }
  isDownloaded(id: string) {
    try {
      return !!JSON.parse(localStorage.getItem('gsi_downloaded') || '{}')[id];
    } catch (e) { return false; }
  }
}

export const GSIStore = new GSIStoreClass();
