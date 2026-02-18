import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Request,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { StorageService } from './storage.service';
import { Response } from 'express';

@Controller('storage')
@UseGuards(AuthGuard('jwt'))
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any, @Request() req: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.storageService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      req.user.userId,
    );
  }

  @Get('list')
  async listFiles(@Request() req: any, @Query('page') page: number, @Query('limit') limit: number) {
    return this.storageService.listFiles(req.user.userId, req.user.role, page, limit);
  }

  @Get('download/:id')
  async downloadFile(
    @Param('id') id: string,
    @Request() req: any,
    @Query('key') key: string,
    @Res() res: Response,
  ) {
    if (!key) {
      throw new BadRequestException('Decryption key is required');
    }
    const result = await this.storageService.downloadFile(id, req.user.userId, key);
    
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
    });
    
    res.send(result.buffer);
  }

  @Delete('delete/:id')
  async deleteFile(@Param('id') id: string, @Request() req: any) {
    return this.storageService.deleteFile(id, req.user.userId);
  }

  @Get('verify/:id')
  async verifyFile(@Param('id') id: string) {
    return this.storageService.verifyFileIntegrity(id);
  }
}
