// src/lifecycle/lifecycle.module.ts
import { Module } from '@nestjs/common';
import { LifecycleService } from './lifecycle.service';

@Module({
  providers: [LifecycleService],
})
export class LifecycleModule {}
