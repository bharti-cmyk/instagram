import {
  Table,
  Column,
  DataType,
  HasMany,
  Model,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { User } from '../users/user.model';

@Table({
  tableName: 'follows',
  timestamps: true,
  indexes: [
    {
      fields: ['followerId', 'followedId'],
      unique: true,
    },
    {
      fields: ['followerId'],
    },
    {
      fields: ['followedId'],
    },
  ],
})
export class Follow extends Model<Follow> {
  @ForeignKey(() => User)
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    allowNull: false,
    primaryKey: true,
  })
  declare followerId: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.BIGINT.UNSIGNED,
    allowNull: false,
    primaryKey: true,
  })
  declare followedId: number;

  @BelongsTo(() => User, { foreignKey: 'followerId', as: 'follower' })
  follower: User;

  @BelongsTo(() => User, { foreignKey: 'followedId', as: 'followed' })
  followed: User;
}
