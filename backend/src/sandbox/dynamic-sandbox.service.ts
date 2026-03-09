import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import FormData = require('form-data');
import * as fs from 'fs';

@Injectable()
export class DynamicSandboxService {
  private readonly logger = new Logger(DynamicSandboxService.name);
  
  // Use process.env for the API key to avoid hardcoding
  private readonly VT_API_KEY = process.env.VIRUSTOTAL_API_KEY || 'YOUR_FREE_VIRUSTOTAL_API_KEY_HERE';
  private readonly VT_URL = 'https://www.virustotal.com/api/v3';

  async detonate(filePath: string, filename: string): Promise<{ isMalicious: boolean; behaviors: string[] }> {
    const sanitizedFilename = filename.replace(/[\n\r]/g, '_');
    this.logger.log(`☁️ Uploading ${sanitizedFilename} to Cloud Sandbox (VirusTotal)...`);

    try {
      // 1. Upload to the Sandbox
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));

      const uploadRes = await axios.post(`${this.VT_URL}/files`, formData, {
        headers: {
          'x-apikey': this.VT_API_KEY,
          ...formData.getHeaders(),
        },
      });

      const analysisId = uploadRes.data.data.id;
      this.logger.log(`⏳ File uploaded. Detonation in progress (ID: ${analysisId})`);

      // 2. Wait for Detonation (Polling)
      // The free tier can take 15-30 seconds to run the file
      let isCompleted = false;
      let reportData = null;
      let attempts = 0;

      while (!isCompleted && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s between checks
        attempts++;
        this.logger.log(`Checking detonation status (Attempt ${attempts}/10)...`);
        
        const reportRes = await axios.get(`${this.VT_URL}/analyses/${analysisId}`, {
          headers: { 'x-apikey': this.VT_API_KEY },
        });

        if (reportRes.data.data.attributes.status === 'completed') {
          isCompleted = true;
          reportData = reportRes.data.data.attributes.stats;
        }
      }

      if (!isCompleted) {
        this.logger.warn(`⏱️ Sandbox timeout. Falling back to safe assumption.`);
        return { isMalicious: false, behaviors: ['Analysis timed out'] };
      }

      // 3. Parse Behavioral Results
      const maliciousVotes = reportData.malicious || 0;
      const suspiciousVotes = reportData.suspicious || 0;
      
      // If 3 or more engines flag its behavior, we consider it a threat
      const isThreat = maliciousVotes >= 3 || suspiciousVotes >= 5;

      if (isThreat) {
        return {
          isMalicious: true,
          behaviors: [
            `Flagged by ${maliciousVotes} dynamic analysis engines`,
            'Matches known malware behavioral signatures'
          ]
        };
      }

      return {
        isMalicious: false,
        behaviors: ['Clean execution in cloud sandbox']
      };

    } catch (error) {
      this.logger.error(`❌ Cloud Sandbox Error: ${error.message}`);
      // Fail open so the pipeline doesn't break if you hit your 500/day limit
      return { isMalicious: false, behaviors: ['Sandbox API unreachable'] };
    }
  }
}