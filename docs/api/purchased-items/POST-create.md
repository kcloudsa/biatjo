# POST /api/purchased-items

- Auth: JWT (self; admin may specify userId)
- Body: { userId?, productId, snapshot }
- 201: { success: true, data }
