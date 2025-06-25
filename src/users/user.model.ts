import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  AllowNull,
} from 'sequelize-typescript';
import { Post } from '../posts/post.model';
import { Follow } from 'src/follows/follow.model';

@Table({
  tableName: 'users',
  timestamps: true,
  indexes: [
    {
      fields: ['username'],
    },
    {
      fields: ['email'],
    },
  ],
})
export class User extends Model<User> {
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @Column({
    allowNull: false,
    unique: true,
  })
  declare username: string;

  @Column({
    allowNull: false,
    unique: true,
  })
  declare email: string;

  @Column({
    allowNull: false,
  })
  password: string;

  @Column({
    type: DataType.TEXT,
  })
  bio: string;

  @Column({
    type: DataType.TEXT,
  })
  avatarUrl: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isCelebrity: boolean;

  @Column({
    type: DataType.BIGINT,
    allowNull: true,
    comment: 'Post ID of the last seen post for this user',
  })
  lastSeenPostId: string | null;

  @HasMany(() => Post)
  posts: Post[];

  @HasMany(() => Follow, {
    foreignKey: 'followerId',
    as: 'following',
  })
  following: Follow[];

  @HasMany(() => Follow, {
    foreignKey: 'followedId',
    as: 'followers',
  })
  followers: Follow[];
}
