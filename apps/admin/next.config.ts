import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 로컬 네트워크의 다른 기기(노트북 등)에서 접속 시 HMR 허용
  allowedDevOrigins: [
    '210.100.180.64',   // 데스크탑 네트워크 IP
    '192.168.217.1',
    '192.168.111.1',
    '172.22.96.1',
  ],
};

export default nextConfig;
