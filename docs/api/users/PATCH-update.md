# PATCH /api/users/:id

- Auth: JWT (self or admin)
- Body: Partial<User> (restricted fields for non-admin)
- 200: updated user
