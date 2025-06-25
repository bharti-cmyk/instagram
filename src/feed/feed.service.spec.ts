import { Test, TestingModule } from '@nestjs/testing';
import { FeedService } from './feed.service';
import { getModelToken } from '@nestjs/sequelize';
import { Post } from '../posts/post.model';
import { User } from '../users/user.model';

describe('FeedService', () => {
  let service: FeedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        {
          provide: getModelToken(Post),
          useValue: {
            findAll: jest.fn(), // mock DB method
          },
        },
      ],
    }).compile();

    service = module.get<FeedService>(FeedService);
  });

  it('should return empty array if Redis feed is empty', async () => {
    const redisMock = jest.spyOn(require('ioredis').prototype, 'lrange');
    redisMock.mockResolvedValue([]); // simulate empty Redis feed

    const result = await service.getUserFeed(1);
    expect(result).toEqual([]);
  });
});
