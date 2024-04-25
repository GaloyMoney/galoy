import { UsersRepository } from "@/services/mongoose"

export * from "./update-language"
export * from "./get-user-language"
export * from "./add-device-token"
export * from "./list-sessions"

const users = UsersRepository()

export const getUser = async (userId: UserId): Promise<User | RepositoryError> => {
  return users.findById(userId)
}
