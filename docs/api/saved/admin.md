# Admin Saved endpoints

- GET /api/saved/user/:userId
- POST /api/saved/user/:userId { productId }
- DELETE /api/saved/user/:userId { productId }
All require JWT (admin) and respond with { success: true, data }.
