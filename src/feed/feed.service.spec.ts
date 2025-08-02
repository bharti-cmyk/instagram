import { Test, TestingModule } from '@nestjs/testing';
import { FeedService } from './feed.service';
import { getModelToken } from '@nestjs/sequelize';
import { Post } from '../posts/post.model';
import { User } from '../users/user.model';
import { Follow } from '../follows/follow.model';

describe('FeedService', () => {
  let service: FeedService;

  const mockRedis = {
    zrevrangebyscore: jest.fn().mockResolvedValue([]),
    zrangebyscore: jest.fn().mockResolvedValue([]),
  };

  const mockPostModel = {
    findAll: jest.fn().mockResolvedValue([]),
  };

  const mockUserModel = {
    update: jest.fn().mockResolvedValue([1]),
  };

  const mockFollowModel = {
    findAll: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedis,
        },
        {
          provide: getModelToken(Post),
          useValue: mockPostModel,
        },
        {
          provide: getModelToken(User),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Follow),
          useValue: mockFollowModel,
        },
      ],
    }).compile();

    service = module.get<FeedService>(FeedService);
  });

  it('should return empty posts if redis and celeb posts are empty', async () => {
  // 🧠 Mock one celebrity followee
  mockFollowModel.findAll.mockResolvedValue([
    {
      followedId: 2,
      get: () => ({
        get: () => true // isCelebrity = true
      }),
    },
  ]);

  mockRedis.zrevrangebyscore.mockResolvedValue([]); // fanout empty
  mockPostModel.findAll.mockResolvedValue([]); // celeb posts empty

  const result = await service.getUserFeed(1);

  expect(result).toEqual({ posts: [], nextCursor: null });
  expect(mockRedis.zrevrangebyscore).toHaveBeenCalled();
  expect(mockPostModel.findAll).toHaveBeenCalled(); // celeb posts
});


  it('should update lastSeenPostId if posts are present', async () => {
    mockRedis.zrevrangebyscore.mockResolvedValue(['101']);
    mockPostModel.findAll
    .mockResolvedValueOnce([
      { id: 101, userId: 1, User: { id: 1, username: 'user1', avatarUrl: '' } },
    ]) // First call is for Redis posts
    .mockResolvedValueOnce([
      { id: 102, userId: 2, User: { id: 2, username: 'celeb', avatarUrl: '' } },
    ]); // Second call is for celebrity posts

    const result = await service.getUserFeed(1);

    expect(result.posts.length).toBe(2);
    expect(result.posts.map(p => p.id).sort()).toEqual(['101', '102']);
    expect(mockUserModel.update).toHaveBeenCalledWith(
      { lastSeenPostId: '10' },
      { where: { id: 1 } }
    );
    expect(mockRedis.zrevrangebyscore).toHaveBeenCalledWith();
    expect(mockPostModel.findAll).toHaveBeenCalledTimes(2); // Called twice, once for each type of post
  });
});
