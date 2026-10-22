# POST /api/brands/:id/cover

- Auth: JWT (admin)
- Content-Type: multipart/form-data
- Field: cover (image)
- Response 200: { success: true, url, data: Brand }
- Errors: 400 (no file), 404 (brand not found), 403 (forbidden)
