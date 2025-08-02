# Instagram Clone API

A full-featured Instagram clone backend API built with NestJS, featuring authentication, posts, comments, likes, follows, notifications, and real-time features.

## 🚀 Features

- **Authentication & Authorization**
  - JWT-based authentication
  - Refresh token support
  - Password reset functionality
  - Profile management

- **Social Features**
  - Create, read, update, delete posts
  - Add comments to posts
  - Like/unlike posts
  - Follow/unfollow users
  - User profiles and avatars

- **Real-time Notifications**
  - Push notifications via Firebase
  - Email notifications
  - In-app notification system
  - Real-time updates using Redis pub/sub

- **Feed System**
  - Personalized user feed
  - Feed generation with background workers
  - Caching with Redis

- **File Upload**
  - Image upload for posts and avatars
  - File validation and processing

- **Graceful Shutdown**
  - SIGINT signal handling for clean application shutdown
  - Proper cleanup of database connections
  - Redis connection cleanup
  - Background worker termination

## 🛠 Tech Stack

- **Framework**: NestJS (Node.js)
- **Database**: MySQL with Sequelize ORM
- **Cache**: Redis
- **Queue**: BullMQ for background jobs
- **File Storage**: Local file system
- **Push Notifications**: Firebase Admin SDK
- **Email**: Nodemailer
- **Testing**: Jest with supertest
- **Documentation**: Swagger/OpenAPI

## 📋 Prerequisites

- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- Redis (v6.2 or higher)
- npm or yarn

## 🚀 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd instagram
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory with the following keys:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USERNAME=root
   DB_PASSWORD=your_password
   DB_NAME=instagram_clone

   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379

   # JWT Configuration
   JWT_SECRET=your_jwt_secret_key
   JWT_REFRESH_SECRET=your_jwt_refresh_secret_key

   # Email Configuration (for password reset)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password

   # Firebase Configuration (for push notifications)
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_PRIVATE_KEY=your_private_key
   FIREBASE_CLIENT_EMAIL=your_client_email

   # Application Configuration
   PORT=3000
   NODE_ENV=development

   # File Upload Configuration
   UPLOAD_DEST=./uploads
   MAX_FILE_SIZE=5242880

   # Rate Limiting
   THROTTLE_TTL=60000
   THROTTLE_LIMIT=10
   ```

4. **Database Setup**
   ```bash
   # Create the database
   mysql -u root -p -e "CREATE DATABASE instagram_clone;"
   ```

5. **Database Seeding**
   ```bash
   # Seed the database with sample data
   npm run seed
   ```
   
   This will create:
   - Sample users with different roles
   - Sample posts with images
   - Sample comments and likes
   - Sample follow relationships
   - Test data for development

6. **Run the application**
   ```bash
   # Development mode
   npm run start:dev

   # Production mode
   npm run start:prod
   ```

## 📚 API Documentation

Once the application is running, you can access the Swagger documentation at:
```
http://localhost:3000/api
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Run specific test file
npm test -- src/comments/tests/comments.service.spec.ts
```

## 📁 Project Structure

```
src/
├── auth/                 # Authentication module
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.guard.ts
│   └── dto/             # Data transfer objects
├── users/               # User management
│   ├── user.model.ts
│   └── user.module.ts
├── posts/               # Post functionality
│   ├── post.controller.ts
│   ├── post.service.ts
│   ├── post.model.ts
│   └── dto/
├── comments/            # Comment functionality
│   ├── comments.controller.ts
│   ├── comments.service.ts
│   ├── comment.model.ts
│   └── dto/
├── likes/               # Like functionality
│   ├── likes.controller.ts
│   ├── likes.service.ts
│   └── like.model.ts
├── follows/             # Follow functionality
│   ├── follow.controller.ts
│   ├── follow.service.ts
│   └── follow.model.ts
├── feed/                # Feed generation
│   ├── feed.service.ts
│   ├── feed.worker.ts
│   └── feed.queue.ts
├── notification/        # Notification system
│   ├── notification.service.ts
│   ├── notification.worker.ts
│   └── notification.listener.ts
├── database/            # Database configuration
│   ├── database.module.ts
│   └── redis.service.ts
├── seed/                # Database seeding
│   ├── index.ts
│   ├── user.seed.ts
│   ├── post.seed.ts
│   └── follow.seed.ts
└── utils/               # Utility functions
    ├── lifecycle.service.ts
    └── model.associate.ts
```

## 🔧 Available Scripts

```bash
# Development
npm run start:dev        # Start in watch mode
npm run start:debug      # Start in debug mode

# Production
npm run build           # Build the application
npm run start:prod      # Start in production mode

# Testing
npm run test            # Run unit tests
npm run test:e2e        # Run e2e tests
npm run test:cov        # Run tests with coverage

# Workers
npm run start:feed-worker      # Start feed generation worker
npm run start:notif-worker     # Start notification worker

# Database
npm run seed            # Seed the database with sample data
```

## 🛑 Graceful Shutdown

The application implements proper signal handling for graceful shutdown:

### SIGINT Handling
- **Database Connections**: All Sequelize connections are properly closed
- **Redis Connections**: Redis client connections are terminated
- **Background Workers**: BullMQ workers are stopped gracefully
- **File Handles**: All open file handles are closed
- **Memory Cleanup**: Proper cleanup of in-memory resources

### Implementation Details
```typescript
// The application listens for SIGINT signal
process.on('SIGINT', async () => {
  console.log('🔄 Received SIGINT, shutting down gracefully...');
  
  // Close database connections
  await sequelize.close();
  
  // Close Redis connections
  await redis.quit();
  
  // Stop background workers
  await feedWorker.close();
  await notificationWorker.close();
  
  console.log('✅ Graceful shutdown completed');
  process.exit(0);
});
```

### Manual Shutdown
You can also trigger graceful shutdown manually:
```bash
# Send SIGINT signal
Ctrl+C

# Or kill the process
kill -SIGINT <process_id>
```

## 🔌 API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `POST /auth/logout` - Logout user
- `POST /auth/refresh` - Refresh access token
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password

### Users
- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update user profile
- `POST /users/avatar` - Upload avatar

### Posts
- `POST /posts` - Create a new post
- `GET /posts` - Get user's posts
- `PUT /posts/:postId` - Update post
- `DELETE /posts/:postId` - Delete post

### Comments
- `POST /posts/:postId/comments` - Add comment to post
- `GET /posts/:postId/comments` - Get comments for post
- `DELETE /posts/:postId/comments/:commentId` - Delete comment

### Likes
- `POST /posts/:postId/likes` - Like a post
- `DELETE /posts/:postId/likes` - Unlike a post

### Follows
- `POST /users/:userId/follow` - Follow a user
- `DELETE /users/:userId/follow` - Unfollow a user
- `GET /users/:userId/followers` - Get user's followers
- `GET /users/:userId/following` - Get users being followed

### Feed
- `GET /feed` - Get personalized feed

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## 📊 Database Schema

The application uses MySQL with the following main tables:
- `Users` - User accounts and profiles
- `Posts` - User posts with captions and images
- `Comments` - Comments on posts
- `Likes` - Post likes
- `Follows` - User follow relationships
- `Notifications` - User notifications

## 🌱 Database Seeding

The application includes a comprehensive seeding system to populate the database with sample data:

### Seed Data Includes:
- **Users**: Multiple test users with different roles (regular users, celebrities)
- **Posts**: Sample posts with captions and images
- **Comments**: Various comments on posts
- **Likes**: Sample like relationships
- **Follows**: Sample follow relationships between users

### Running Seeds:
```bash
# Seed all data
npm run seed

# Or run individual seed files
npx ts-node src/seed/user.seed.ts
npx ts-node src/seed/post.seed.ts
npx ts-node src/seed/follow.seed.ts
```

### Seed Configuration:
- Seeds are idempotent (safe to run multiple times)
- Includes data validation
- Handles foreign key relationships
- Provides realistic test data for development

## 🔄 Background Workers

The application uses background workers for:
- **Feed Generation**: Processes user feeds in the background
- **Notifications**: Handles email and push notifications
- **Queue Management**: Manages job queues with BullMQ

### 🚀 Feed Generation System

The feed system implements a **Fan-out/Fan-in** pattern for efficient feed generation:

#### Fan-out Pattern
When a user creates a post, the system "fans out" to all their followers:
```typescript
// When a post is created
const followers = await getFollowers(userId);
followers.forEach(follower => {
  // Add to each follower's feed queue
  await feedQueue.add('new-post', {
    postId,
    userId,
    followerId: follower.id
  });
});
```

#### Fan-in Pattern
The feed worker processes multiple posts and "fans in" to create a unified feed:
```typescript
// Feed worker processes multiple posts
const feedItems = await Promise.all(
  posts.map(post => ({
    post,
    user: await getUser(post.userId),
    likes: await getLikes(post.id),
    comments: await getComments(post.id)
  }))
);
```

#### Feed Architecture
- **Real-time Updates**: New posts are immediately added to followers' feeds
- **Background Processing**: Feed generation happens asynchronously
- **Caching**: Redis caches feed data for fast retrieval
- **Pagination**: Supports paginated feed loading

### 📧 Notification System

The notification system uses a **Fan-out** pattern for multi-channel notifications:

#### Notification Channels
- **Push Notifications**: Via Firebase Cloud Messaging
- **Email Notifications**: Via Nodemailer
- **In-app Notifications**: Stored in database
- **Real-time Updates**: Via Redis pub/sub

#### Notification Worker
```typescript
// Notification worker processes different event types
const notificationWorker = new Worker('notifications', async (job) => {
  const { type, fromUserId, toUserId, postId, text } = job.data;
  
  // Fan-out to multiple notification channels
  await Promise.all([
    sendPushNotification(toUserId, type, text),
    sendEmailNotification(toUserId, type, text),
    saveInAppNotification(toUserId, type, postId),
    publishRealTimeUpdate(toUserId, type)
  ]);
});
```

#### Notification Types
- **Comment Notifications**: When someone comments on your post
- **Like Notifications**: When someone likes your post
- **Follow Notifications**: When someone follows you
- **Mention Notifications**: When someone mentions you in a comment

### 🔄 BullMQ Queue Management

The application uses BullMQ for robust queue management with Redis as the backend:

#### Queue Configuration
```typescript
// Feed Queue
const feedQueue = new Queue('feed-generation', {
  connection: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT)
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

// Notification Queue
const notificationQueue = new Queue('notifications', {
  connection: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT)
  },
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
});
```

#### Queue Features
- **Job Retry**: Automatic retry with exponential backoff
- **Job Priority**: High priority for critical notifications
- **Job Delays**: Delayed job execution for scheduled tasks
- **Job Cleanup**: Automatic cleanup of completed/failed jobs
- **Queue Monitoring**: Real-time queue status monitoring

#### Worker Implementation
```typescript
// Feed Worker
const feedWorker = new Worker('feed-generation', async (job) => {
  const { postId, userId, followerId } = job.data;
  
  try {
    // Process feed item
    await addToFeed(followerId, postId);
    console.log(`✅ Feed updated for user ${followerId}`);
  } catch (error) {
    console.error(`❌ Feed update failed: ${error.message}`);
    throw error; // Retry the job
  }
}, {
  concurrency: 10, // Process 10 jobs concurrently
  limiter: {
    max: 100,
    duration: 1000
  }
});

// Notification Worker
const notificationWorker = new Worker('notifications', async (job) => {
  const { type, fromUserId, toUserId, postId, text } = job.data;
  
  try {
    // Send notification through multiple channels
    await Promise.all([
      sendPushNotification(toUserId, type, text),
      sendEmailNotification(toUserId, type, text),
      saveInAppNotification(toUserId, type, postId)
    ]);
    console.log(`✅ Notification sent to user ${toUserId}`);
  } catch (error) {
    console.error(`❌ Notification failed: ${error.message}`);
    throw error; // Retry the job
  }
}, {
  concurrency: 5, // Process 5 jobs concurrently
  limiter: {
    max: 50,
    duration: 1000
  }
});
```

#### Queue Monitoring
```typescript
// Monitor queue health
feedQueue.on('completed', (job) => {
  console.log(`✅ Feed job ${job.id} completed`);
});

feedQueue.on('failed', (job, err) => {
  console.error(`❌ Feed job ${job.id} failed:`, err.message);
});

notificationQueue.on('completed', (job) => {
  console.log(`✅ Notification job ${job.id} completed`);
});

notificationQueue.on('failed', (job, err) => {
  console.error(`❌ Notification job ${job.id} failed:`, err.message);
});
```

### 🔄 Real-time Updates with Redis Pub/Sub

The application uses Redis pub/sub for real-time updates:

#### Publisher Pattern
```typescript
// Publish real-time updates
await redis.publish('notification-comment', JSON.stringify({
  fromUserId,
  toUserId,
  type: 'comment',
  postId,
  text: commentText,
  timestamp: new Date().toISOString()
}));
```

#### Subscriber Pattern
```typescript
// Subscribe to real-time updates
const subscriber = new Redis();
await subscriber.subscribe('notification-comment', 'notification-like', 'notification-follow');

subscriber.on('message', (channel, message) => {
  const data = JSON.parse(message);
  // Handle real-time notification
  handleRealTimeNotification(data);
});
```

### 📊 Queue Performance Metrics

The system tracks various performance metrics:

#### Feed Generation Metrics
- **Processing Time**: Average time to process feed items
- **Throughput**: Number of feed items processed per second
- **Error Rate**: Percentage of failed feed generation jobs
- **Queue Size**: Number of pending feed generation jobs

#### Notification Metrics
- **Delivery Rate**: Percentage of successful notifications
- **Channel Performance**: Success rates for push, email, in-app
- **Latency**: Time from event to notification delivery
- **Queue Depth**: Number of pending notifications

### 🛠 Queue Management Commands

```bash
# Start feed worker
npm run start:feed-worker

# Start notification worker
npm run start:notif-worker

# Monitor queue status
redis-cli
> LLEN bull:feed-generation:wait
> LLEN bull:notifications:wait

# Clear failed jobs
redis-cli
> DEL bull:feed-generation:failed
> DEL bull:notifications:failed
```

### 🔧 Queue Configuration

#### Environment Variables for Queues
```env
# Redis Configuration for Queues
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Queue Configuration
QUEUE_CONCURRENCY=10
QUEUE_MAX_ATTEMPTS=3
QUEUE_BACKOFF_DELAY=2000

# Worker Configuration
FEED_WORKER_CONCURRENCY=10
NOTIFICATION_WORKER_CONCURRENCY=5
```

#### Queue Health Checks
```typescript
// Health check for queues
async function checkQueueHealth() {
  const feedQueueSize = await feedQueue.count();
  const notificationQueueSize = await notificationQueue.count();
  
  console.log(`📊 Queue Status:`);
  console.log(`  Feed Queue: ${feedQueueSize} jobs`);
  console.log(`  Notification Queue: ${notificationQueueSize} jobs`);
  
  return {
    feedQueue: feedQueueSize,
    notificationQueue: notificationQueueSize
  };
}
```

## 🚀 Deployment

### Environment Variables
Make sure to set all required environment variables in production.

### Database Migration
The application uses Sequelize with `synchronize: true` for automatic schema management. For production, consider using migrations.

### Redis Configuration
Ensure Redis is properly configured for caching and queue management.

### File Storage
For production, consider using cloud storage (AWS S3, Google Cloud Storage) instead of local file storage.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/your-repo/issues) page
2. Create a new issue with detailed information
3. Contact the development team

## 🔄 Changelog

### v1.0.0
- Initial release
- Core authentication system
- Post, comment, like functionality
- Follow/unfollow system
- Real-time notifications
- Feed generation
- File upload support
- Graceful shutdown implementation
- Comprehensive database seeding
- Complete environment configuration
