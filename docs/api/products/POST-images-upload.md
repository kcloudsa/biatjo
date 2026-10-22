# POST /api/products/:id/images/upload

- Auth: JWT (admin)
- Content-Type: multipart/form-data
- Field: images (image[], up to 10)
- Response 200: { success: true, urls: string[], data: Product }
- Errors: 400 (no files), 404 (product not found), 403 (forbidden)
