# Admin Follow endpoints

- GET /api/follow/user/:userId
- POST /api/follow/user/:userId { brandId }
- DELETE /api/follow/user/:userId { brandId }
All require JWT (admin) and respond with { success: true, data }.
