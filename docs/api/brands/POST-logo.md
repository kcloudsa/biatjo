# POST /api/brands/:id/logo

- Auth: JWT (admin)
- Content-Type: multipart/form-data
- Field: logo (image)
- Response 200: { success: true, url, data: Brand }
- Errors: 400 (no file), 404 (brand not found), 403 (forbidden)
