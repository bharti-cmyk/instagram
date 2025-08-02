import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class LogoutDto{
    @ApiProperty({ example: 'User logged out successfully', description: 'Logout message' })
    @IsString()
    message: string
}