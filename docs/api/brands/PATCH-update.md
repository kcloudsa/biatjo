# PATCH /api/brands/:id

- Auth: JWT (admin or future ownership rules)
- Body: Partial<IBrand>
- 200: { success: true, data: Brand }
- 404 if not found
