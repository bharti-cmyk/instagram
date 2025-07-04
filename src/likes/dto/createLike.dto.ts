import { IsNumber } from 'class-validator'

export class createLike{
    @IsNumber()
    userId: number

    @IsNumber()
    postId: number
}