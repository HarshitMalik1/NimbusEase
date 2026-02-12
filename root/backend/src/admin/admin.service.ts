import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObjectId } from 'mongodb';
import { AdminProposal, ProposalStatus } from './admin-proposal.entity';
import { User, UserRole } from '../users/user.entity';
import { AuditService } from '../audit/audit.service';
import * as crypto from 'crypto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private otps: Map<string, { code: string; expiresAt: Date }> = new Map();

  constructor(
    @InjectRepository(AdminProposal)
    private proposalRepository: Repository<AdminProposal>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private auditService: AuditService,
  ) {}

  async createProposal(proposerId: string, actionType: string, payload: any) {
    const adminCount = await this.userRepository.count({ where: { role: UserRole.ADMIN } });
    if (adminCount < 3) {
      throw new BadRequestException('System requires at least 3 admins for multi-approval workflow.');
    }

    const proposal = this.proposalRepository.create({
      proposerId,
      actionType,
      payload,
      approvedBy: [proposerId], // Auto-approve by proposer
      status: ProposalStatus.PENDING,
    });

    await this.proposalRepository.save(proposal);
    
    await this.auditService.logAction(proposerId, 'ADMIN_PROPOSAL_CREATED', {
      proposalId: proposal.id.toString(),
      actionType,
    });

    return proposal;
  }

  async approveProposal(adminId: string, proposalId: string) {
    const proposal = await this.proposalRepository.findOne({ where: { id: new ObjectId(proposalId) } });
    if (!proposal) throw new BadRequestException('Proposal not found');
    if (proposal.status !== ProposalStatus.PENDING) throw new BadRequestException('Proposal is no longer pending');
    if (proposal.approvedBy.includes(adminId)) throw new BadRequestException('Admin already approved');

    proposal.approvedBy.push(adminId);

    // If 3 admins have approved, mark as APPROVED
    if (proposal.approvedBy.length >= 3) {
      proposal.status = ProposalStatus.APPROVED;
    }

    await this.proposalRepository.save(proposal);
    
    await this.auditService.logAction(adminId, 'ADMIN_PROPOSAL_APPROVED', {
      proposalId,
      approvalsCount: proposal.approvedBy.length,
    });

    return proposal;
  }

  async generateMobileOtp(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: new ObjectId(userId) } });
    if (!user) throw new BadRequestException('User not found');

    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    this.otps.set(userId, { code, expiresAt });

    this.logger.log(`[OTP] Generated OTP ${code} for user ${userId} (Expires in 10 mins)`);
    // In a real app, send via SMS here.
    
    return { message: 'OTP sent to mobile', expiresAt };
  }

  async verifyMobileOtp(userId: string, code: string) {
    const otpData = this.otps.get(userId);
    if (!otpData) throw new UnauthorizedException('No OTP found');
    if (otpData.expiresAt < new Date()) {
      this.otps.delete(userId);
      throw new UnauthorizedException('OTP expired');
    }
    if (otpData.code !== code) {
      throw new UnauthorizedException('Invalid OTP');
    }

    this.otps.delete(userId);
    return true;
  }

  async executeProtectedAction(adminId: string, proposalId: string, otpCode: string) {
    // 1. Verify OTP first (Protects the action itself)
    await this.verifyMobileOtp(adminId, otpCode);

    // 2. Check Proposal Status
    const proposal = await this.proposalRepository.findOne({ where: { id: new ObjectId(proposalId) } });
    if (!proposal) throw new BadRequestException('Proposal not found');
    if (proposal.status !== ProposalStatus.APPROVED) {
      throw new BadRequestException('Proposal must be approved by 3 admins before execution');
    }

    // 3. Mark as EXECUTED
    proposal.status = ProposalStatus.EXECUTED;
    await this.proposalRepository.save(proposal);

    await this.auditService.logAction(adminId, 'ADMIN_ACTION_EXECUTED', {
      proposalId,
      actionType: proposal.actionType,
    });

    return { message: 'Action executed successfully', result: proposal.payload };
  }

  async listPendingProposals() {
    return this.proposalRepository.find({ where: { status: ProposalStatus.PENDING } });
  }
}
