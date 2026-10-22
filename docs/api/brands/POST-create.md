# POST /api/brands

- Auth: JWT (admin)
- Body: Partial<IBrand>
- 201: { success: true, data: Brand }
- 403 if not admin
