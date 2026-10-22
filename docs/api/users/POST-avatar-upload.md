# POST /api/users/:id/avatar/upload

- Auth: JWT (self or admin)
- Content-Type: multipart/form-data
- Field: avatar (image)
- Response 200: { success: true, url, path }
- Errors: 400 (no file), 404 (user not found), 403 (forbidden)
