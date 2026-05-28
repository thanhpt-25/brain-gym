import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import multer from 'multer';
import { StorageService } from './storage.service';

/** Used only in local-dev mode (no S3 configured). Saves the file to disk. */
@Injectable()
export class AvatarUploadInterceptor implements NestInterceptor {
  constructor(private readonly storageService: StorageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const upload = multer({
      storage: this.storageService.buildLocalDiskStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|gif|webp)$/)) {
          return cb(
            new BadRequestException('Only image files are allowed') as any,
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 2 * 1024 * 1024 },
    }).single('file');

    return new Observable((observer) => {
      upload(req, res, (err) => {
        if (err) {
          observer.error(
            err instanceof BadRequestException
              ? err
              : new BadRequestException(err.message),
          );
        } else {
          next.handle().subscribe(observer);
        }
      });
    });
  }
}
