import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { User } from '../users/user.model';
import { Post } from '../posts/post.model';

@Table({ tableName: 'notifications',
    timestamps: true
 })
export class Notification extends Model<Notification> {
  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  toUserId: number;

  @ForeignKey(() => User)
  @Column(DataType.INTEGER)
  fromUserId: number;

  @ForeignKey(() => Post)
  @Column(DataType.INTEGER)
  postId: number

  @Column(DataType.STRING)
  type: 'follow' | 'like' | 'comment';

  @Column(DataType.BOOLEAN)
  isRead: boolean;

}
