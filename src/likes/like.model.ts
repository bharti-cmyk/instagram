import { Table, Model, ForeignKey, Column, PrimaryKey, AutoIncrement, BelongsTo } from "sequelize-typescript";
import { Post } from "../posts/post.model";
import { User } from "../users/user.model";

@Table({ tableName: 'likes', timestamps: true })
export class Like extends Model<Like> {
    @PrimaryKey
    @AutoIncrement
    @Column
    declare id: number;

    @ForeignKey(() => User)
    @Column({
        type: 'BIGINT',
        allowNull: false,
    })
    declare UserId: number;

    @ForeignKey(() => Post)
    @Column({
        type: 'BIGINT',
        allowNull: false,
    })
    declare PostId: string;

}