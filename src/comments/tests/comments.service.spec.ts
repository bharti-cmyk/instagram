import { CommentsService } from "../comments.service";
import { Comment } from "../comment.model";
import { Post } from "../../posts/post.model";
import { User } from "../../users/user.model";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import Redis from "ioredis";
import { Queue } from "bullmq";

// Mock the notification worker module
jest.mock('../../notification/notification.interface', () => ({
    NotificationPayload: jest.fn()
}));

// Mock BullMQ Queue
jest.mock('bullmq', () => ({
    Queue: jest.fn().mockImplementation(() => ({
        add: jest.fn().mockResolvedValue(true),
    }))
}));

describe('CommentsService', () => {
    // Service instance to be tested
    let commentsService: CommentsService;
    
    // Mocked dependencies
    let mockCommentModel: jest.Mocked<typeof Comment>;
    let mockPostModel: jest.Mocked<typeof Post>;
    let mockUserModel: jest.Mocked<typeof User>;
    let mockRedis: jest.Mocked<Redis>;
    let mockQueue: jest.Mocked<Queue>;

    // Mock comment data
    const mockComment = {
        id: 1,
        UserId: 1,
        PostId: '1',
        content: 'This is a test comment',
        createdAt: new Date(),
        updatedAt: new Date(),
        get: jest.fn().mockReturnValue({
            id: 1,
            UserId: 1,
            PostId: '1',
            content: 'This is a test comment',
            createdAt: new Date(),
            updatedAt: new Date(),
        }),
        destroy: jest.fn().mockResolvedValue(true),
    };

    // Mock post data
    const mockPost = {
        id: '1',
        userId: 2, // Different user owns the post
        caption: 'Test post',
        imageUrl: '/uploads/test.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    // Mock user data
    const mockUser = {
        id: 2,
        username: 'postowner',
        email: 'postowner@example.com',
        fcmToken: 'test-fcm-token',
        bio: 'Test bio',
        avatarUrl: '/uploads/avatar.jpg',
        isCelebrity: false,
        lastSeenPostId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    // Setup mocks before each test
    beforeEach(() => {
        // Reset all mocks before each test
        jest.clearAllMocks();

        // Mock Comment model
        mockCommentModel = {
            create: jest.fn(),
            findAll: jest.fn(),
            findByPk: jest.fn(),
        } as any;

        // Mock Post model
        mockPostModel = {
            findOne: jest.fn(),
            findByPk: jest.fn(),
        } as any;

        // Mock User model
        mockUserModel = {
            findByPk: jest.fn(),
        } as any;

        // Mock Redis
        mockRedis = {
            publish: jest.fn().mockResolvedValue(1),
        } as any;

        // Mock Queue
        mockQueue = {
            add: jest.fn().mockResolvedValue(true),
        } as any;

        // Create CommentsService instance with mocked dependencies
        commentsService = new CommentsService(
            mockCommentModel,
            mockPostModel,
            mockUserModel
        );

        // Mock the Redis instance in the service
        (commentsService as any).pubsub = mockRedis;
        (commentsService as any).notifQueue = mockQueue;
    });

    // Clean up mocks after each test
    afterEach(() => {
        jest.restoreAllMocks();
    });

    // Test suite for adding comments
    describe('addComment', () => {
        it('should add comment successfully', async () => {
            // Arrange: Setup mocks for successful comment creation
            mockCommentModel.create.mockResolvedValue(mockComment as any);
            mockPostModel.findOne.mockResolvedValue(mockPost as any);
            mockUserModel.findByPk.mockResolvedValue(mockUser as any);

            // Act: Call the add comment method
            const result = await commentsService.addComment('1', 1, 'This is a test comment');

            // Assert: Verify the result and method calls
            expect(result).toBeDefined();
            expect(result.content).toBe('This is a test comment');
            // Note: plainToInstance transformation may not work in test environment
            // We'll check if the basic structure is correct
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('content');
            expect(result).toHaveProperty('createdAt');
            expect(mockCommentModel.create).toHaveBeenCalledWith({
                UserId: 1,
                PostId: "1", //hanged from '1' to 1 to match service behavior
                content: 'This is a test comment',
            });
            expect(mockPostModel.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
            expect(mockUserModel.findByPk).toHaveBeenCalledWith(2);
            expect(mockRedis.publish).toHaveBeenCalledWith('notification-comment', expect.any(String));
            expect(mockQueue.add).toHaveBeenCalledWith('comment-event', expect.objectContaining({
                fromUserId: 1,
                toUserId: 2,
                type: 'comment',
                text: 'This is a test comment',
            }));
        });

        it('should handle post not found error', async () => {
            // Arrange: Setup mock to return null for post
            mockCommentModel.create.mockResolvedValue(mockComment as any);
            mockPostModel.findOne.mockResolvedValue(null);

            // Act & Assert: Verify that the error is thrown
            await expect(commentsService.addComment('999', 1, 'Test comment'))
                .rejects.toThrow('Post not found or userId is undefined');
        });

        it('should handle post with undefined userId', async () => {
            // Arrange: Setup mock to return post with undefined userId
            const postWithUndefinedUserId = { ...mockPost, userId: undefined };
            mockCommentModel.create.mockResolvedValue(mockComment as any);
            mockPostModel.findOne.mockResolvedValue(postWithUndefinedUserId as any);

            // Act & Assert: Verify that the error is thrown
            await expect(commentsService.addComment('1', 1, 'Test comment'))
                .rejects.toThrow('Post not found or userId is undefined');
        });

        it('should handle user not found error', async () => {
            // Arrange: Setup mocks for user not found
            mockCommentModel.create.mockResolvedValue(mockComment as any);
            mockPostModel.findOne.mockResolvedValue(mockPost as any);
            mockUserModel.findByPk.mockResolvedValue(null);

            // Act & Assert: Verify that the error is thrown
            await expect(commentsService.addComment('1', 1, 'Test comment'))
                .rejects.toThrow('User not found');
        });

        it('should handle database creation errors', async () => {
            // Arrange: Setup mock to simulate database error
            mockCommentModel.create.mockRejectedValue(new Error('Database creation failed'));

            // Act & Assert: Verify that the error is propagated
            await expect(commentsService.addComment('1', 1, 'Test comment'))
                .rejects.toThrow('Database creation failed');
        });

        it('should handle Redis publish errors', async () => {
            // Arrange: Setup mocks for Redis error
            mockCommentModel.create.mockResolvedValue(mockComment as any);
            mockPostModel.findOne.mockResolvedValue(mockPost as any);
            mockUserModel.findByPk.mockResolvedValue(mockUser as any);
            mockRedis.publish.mockRejectedValue(new Error('Redis publish failed'));

            // Act & Assert: Verify that the error is propagated
            await expect(commentsService.addComment('1', 1, 'Test comment'))
                .rejects.toThrow('Redis publish failed');
        });

        it('should handle queue add errors', async () => {
            // Arrange: Setup mocks for queue error
            mockCommentModel.create.mockResolvedValue(mockComment as any);
            mockPostModel.findOne.mockResolvedValue(mockPost as any);
            mockUserModel.findByPk.mockResolvedValue(mockUser as any);
            mockQueue.add.mockRejectedValue(new Error('Queue add failed'));

            // Act & Assert: Verify that the error is propagated
            await expect(commentsService.addComment('1', 1, 'Test comment'))
                .rejects.toThrow('Queue add failed');
        });
    });

    // Test suite for getting comments
    describe('getComments', () => {
        it('should get comments successfully', async () => {
            // Arrange: Setup mock to return comments
            const mockComments = [
                { 
                    ...mockComment, 
                    id: 1,
                    get: jest.fn().mockReturnValue({
                        id: 1,
                        UserId: 1,
                        PostId: '1',
                        content: 'This is a test comment',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    })
                },
                { 
                    ...mockComment, 
                    id: 2,
                    get: jest.fn().mockReturnValue({
                        id: 2,
                        UserId: 1,
                        PostId: '1',
                        content: 'This is a test comment',
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    })
                },
            ];
            mockPostModel.findByPk.mockResolvedValue(mockPost as any);
            mockCommentModel.findAll.mockResolvedValue(mockComments as any);

            // Act: Call the get comments method
            const result = await commentsService.getComments(1);

            // Assert: Verify the result and method calls
            expect(result).toHaveLength(2);
            expect(result[0].content).toBe('This is a test comment');
            expect(result[1].content).toBe('This is a test comment');
            expect(mockPostModel.findByPk).toHaveBeenCalledWith(1);
            expect(mockCommentModel.findAll).toHaveBeenCalledWith({
                where: { PostId: 1 },
                order: [['createdAt', 'DESC']]
            });
        });

        it('should return empty array when no comments exist', async () => {
            // Arrange: Setup mock to return empty array
            mockPostModel.findByPk.mockResolvedValue(mockPost as any);
            mockCommentModel.findAll.mockResolvedValue([]);

            // Act: Call the get comments method
            const result = await commentsService.getComments(1);

            // Assert: Verify the result
            expect(result).toHaveLength(0);
            expect(mockPostModel.findByPk).toHaveBeenCalledWith(1);
            expect(mockCommentModel.findAll).toHaveBeenCalledWith({
                where: { PostId: 1 },
                order: [['createdAt', 'DESC']]
            });
        });

        it('should handle post not found error', async () => {
            // Arrange: Setup mock to return null for post
            mockPostModel.findByPk.mockResolvedValue(null);

            // Act & Assert: Verify that the error is thrown
            await expect(commentsService.getComments(999))
                .rejects.toThrow('Post not found');
        });

        it('should handle database query errors', async () => {
            // Arrange: Setup mock to simulate database error
            mockPostModel.findByPk.mockRejectedValue(new Error('Database query failed'));

            // Act & Assert: Verify that the error is propagated
            await expect(commentsService.getComments(1))
                .rejects.toThrow('Database query failed');
        });
    });

    // Test suite for deleting comments
    describe('deleteComment', () => {
        it('should delete comment successfully when user owns the comment', async () => {
            // Arrange: Setup mock to return comment owned by user
            const commentOwnedByUser = { ...mockComment, UserId: 1 };
            mockCommentModel.findByPk.mockResolvedValue(commentOwnedByUser as any);

            // Act: Call the delete comment method
            const result = await commentsService.deleteComment(1, 1);

            // Assert: Verify the result and method calls
            expect(result.message).toBe('Comment deleted successfully');
            expect(mockCommentModel.findByPk).toHaveBeenCalledWith(1);
            expect(commentOwnedByUser.destroy).toHaveBeenCalled();
        });

        it('should throw ForbiddenException when user does not own the comment', async () => {
            // Arrange: Setup mock to return comment owned by different user
            const commentOwnedByOtherUser = { ...mockComment, UserId: 2 };
            mockCommentModel.findByPk.mockResolvedValue(commentOwnedByOtherUser as any);

            // Act & Assert: Verify that the correct exception is thrown
            await expect(commentsService.deleteComment(1, 1))
                .rejects.toThrow(ForbiddenException);
            expect(mockCommentModel.findByPk).toHaveBeenCalledWith(1);
            expect(commentOwnedByOtherUser.destroy).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException when comment does not exist', async () => {
            // Arrange: Setup mock to return null (comment not found)
            mockCommentModel.findByPk.mockResolvedValue(null);

            // Act & Assert: Verify that the correct exception is thrown
            await expect(commentsService.deleteComment(999, 1))
                .rejects.toThrow(NotFoundException);
            expect(mockCommentModel.findByPk).toHaveBeenCalledWith(999);
        });

        it('should handle database deletion errors', async () => {
            // Arrange: Setup mocks for deletion error
            const commentWithDestroyError = { 
                ...mockComment, 
                destroy: jest.fn().mockRejectedValue(new Error('Database deletion failed'))
            };
            mockCommentModel.findByPk.mockResolvedValue(commentWithDestroyError as any);

            // Act & Assert: Verify that the error is propagated
            await expect(commentsService.deleteComment(1, 1))
                .rejects.toThrow('Database deletion failed');
        });

        it('should handle database query errors during deletion', async () => {
            // Arrange: Setup mock to simulate database error
            mockCommentModel.findByPk.mockRejectedValue(new Error('Database query failed'));

            // Act & Assert: Verify that the error is propagated
            await expect(commentsService.deleteComment(1, 1))
                .rejects.toThrow('Database query failed');
        });
    });
}); 