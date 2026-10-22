# POST /api/users/:id/change-password

- Auth: JWT (self or admin)
- Body: { oldPassword?, newPassword, allowWithoutOld? }
- 200: { success: true, message }
