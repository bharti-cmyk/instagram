// models/associate.ts
import { User } from '../users/user.model';
import { Post } from '../posts/post.model';
import { Like } from '../likes/like.model';
import { Comment } from '../comments/comment.model';

export function associateModels() {
  // Post relationships
  Post.belongsTo(User, { foreignKey: 'userId' });
  Post.hasMany(Like, { foreignKey: 'postId'});
  Post.hasMany(Comment, { foreignKey: 'postId'});

  // Like relationships
  Like.belongsTo(User, { foreignKey: 'userId'});
  Like.belongsTo(Post, { foreignKey: 'postId'});

  // Comment relationships
  Comment.belongsTo(User, { foreignKey: 'userId'});
  Comment.belongsTo(Post, { foreignKey: 'postId'});

  // User relationships
  User.hasMany(Post, { foreignKey: 'userId'});
  User.hasMany(Like, { foreignKey: 'userId'});
  User.hasMany(Comment, { foreignKey: 'userId'});
}
