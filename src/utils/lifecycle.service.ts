// src/lifecycle/lifecycle.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { associateModels } from './model.associate';

@Injectable()
export class LifecycleService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    console.log('🔄 Associating Sequelize models...');
    associateModels(); // call your association logic here
    console.log('✅ Sequelize models associated successfully');
  }

  async onModuleDestroy() {
    console.log('🧹 Cleaning up lifecycle service...');
    // Add any additional cleanup logic here if needed
    console.log('✅ Lifecycle service cleanup completed');
  }
}
