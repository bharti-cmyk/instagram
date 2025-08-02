// src/lifecycle/lifecycle.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { associateModels } from './model.associate';

@Injectable()
export class LifecycleService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    console.log('Associating Sequelize models...');
    associateModels();
    console.log('Sequelize models associated successfully');
  }

  async onModuleDestroy() {
    console.log('Cleaning up lifecycle service...');
    // Add any cleanup logic here
    console.log('Lifecycle service cleanup completed');
  }
}
