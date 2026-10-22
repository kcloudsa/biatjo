# POST /api/follow/me/toggle

Requires JWT. Body: { brandId }. If the brand is currently followed, unfollows it; otherwise follows it. Also increments/decrements brand.followersCount.

Response: { success: true, data, followed: boolean }
