/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  output: "standalone",
  
    // ✅ évite le crash CloudLinux pendant "Linting and checking validity of types"
      eslint: {
          ignoreDuringBuilds: true,
            },
              typescript: {
                  ignoreBuildErrors: true,
                    },
                    
                      webpack: (config) => {
                          config.resolve.alias["@"] = path.join(__dirname);
                              return config;
                                },
                                };
                                
module.exports = nextConfig;