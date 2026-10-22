# GET /api/brands/:id/followers-count

Public endpoint returning the number of followers for a brand.

- Params: id
- Auth: None
- Response 200: { success: true, data: { brandId: string, followersCount: number } }
- 404: { success: false, message: 'Brand not found' }
