import { Injectable } from '@nestjs/common';

@Injectable()
export class DataSimulatorService {
  private calculateEntropy(text: string): number {
    if (!text) return 0;
    const charCounts = {};
    for (const char of text) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }
    const probs = (Object.values(charCounts) as number[]).map((count: number) => count / text.length);
    return -probs.reduce((sum, p) => sum + p * Math.log2(p), 0);
  }

  generateLogs(nSamples = 1000, anomalyRatio = 0.05) {
    const data = [];
    const users = ['user_1', 'user_2', 'user_3', 'admin', 'service_account'];
    const ips = ['192.168.1.1', '10.0.0.5', '45.23.12.88', '172.16.0.10'];

    for (let i = 0; i < nSamples; i++) {
      const isAnomaly = Math.random() < anomalyRatio;
      let log: any;

      if (!isAnomaly) {
        // Normal traffic
        log = {
          user: users[Math.floor(Math.random() * users.length)],
          ip: ips[Math.floor(Math.random() * ips.length)],
          action: 'READ',
          resource: '/api/products',
          details: 'Standard access',
          statusCode: 200,
          timestamp: new Date().toISOString(),
          isAnomaly: 0,
        };
      } else {
        const attackTypeRoll = Math.random();
        
        if (attackTypeRoll < 0.25) {
          // SQL Injection (Existing)
          log = {
            user: 'unknown',
            ip: '45.23.12.' + Math.floor(Math.random() * 255),
            action: 'QUERY',
            resource: 'users_table',
            details: "SELECT * FROM users WHERE id='1' OR '1'='1'",
            statusCode: 200,
            timestamp: new Date().toISOString(),
            isAnomaly: 1,
            attackType: 'sql_injection'
          };
        } else if (attackTypeRoll < 0.5) {
          // Brute Force Attack
          // "The Anatomical Log Pattern": One IP, many requests, 401/403
          log = {
            user: 'unknown',
            ip: '192.168.1.105', // Fixed attacker IP for pattern
            action: 'LOGIN',
            resource: '/api/auth/login',
            details: 'Failed login attempt',
            statusCode: 401,
            timestamp: new Date().toISOString(),
            isAnomaly: 1,
            attackType: 'brute_force'
          };
        } else if (attackTypeRoll < 0.75) {
          // Path Traversal
          // "The Anatomical Log Pattern": Strange characters in file path
          log = {
            user: 'user_2', // Compromised or malicious user
            ip: '10.0.0.5',
            action: 'READ',
            resource: 'storage/../../etc/passwd',
            details: 'File access attempt',
            statusCode: 403,
            timestamp: new Date().toISOString(),
            isAnomaly: 1,
            attackType: 'path_traversal'
          };
        } else {
          // Ransomware (The "Wipe & Write")
          // "The Anatomical Log Pattern": Burst of DELETE/CREATE
          log = {
            user: 'admin', // Often uses compromised high-privilege account
            ip: '172.16.0.20',
            action: 'DELETE', // Mixed with CREATE in a real stream
            resource: `/storage/files/doc_${Math.floor(Math.random() * 100)}.pdf`,
            details: 'Renaming to .encrypted',
            statusCode: 200,
            timestamp: new Date().toISOString(),
            isAnomaly: 1,
            attackType: 'ransomware'
          };
        }
      }

      // Feature Engineering / Formatting for AI
      log.text_content = `${log.action} ${log.resource} ${log.details}`;
      log.entropy = this.calculateEntropy(log.text_content);
      
      data.push(log);
    }
    return data;
  }
}
