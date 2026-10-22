# PATCH /api/products/:id

- Auth: JWT
- Body: Partial<IProduct>
- 200: { success: true, data: Product }
- 404: not found
