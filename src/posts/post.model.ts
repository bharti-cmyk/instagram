import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  BelongsTo,
  ForeignKey,
} from 'sequelize-typescript';
import { User } from '../users/user.model';
import { Like } from '../likes/like.model';
import { Comment } from '../comments/comment.model';

@Table({
  tableName: 'posts',
  timestamps: true,
  indexes: [
    {
      fields: ['id'],
    },
    {
      fields: ['userId'],
    },
    {
      fields: ['userId', 'id'],
    },
  ],
})
export class Post extends Model<Post> {
  @Column({
    type: DataType.BIGINT,
    primaryKey: true,
  })
  declare id: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    allowNull: false,
  })
  declare userId: number;

  @BelongsTo(() => User)
  user: User;

  @Column({
    type: DataType.TEXT,
  })
  caption: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  imageUrl: string;
}
