<template>
  <div class="product-card">
    <img :src="image" :alt="name">
    <h3>{{ name }}</h3>
    <p class="price">{{ formatPrice(price) }} đ</p>
    <p v-if="oldPrice" class="old-price">{{ formatPrice(oldPrice) }} đ</p>
    <button @click="handleBuy">Mua ngay</button>
  </div>
</template>

<script setup>
defineProps({
  name: String,
  price: Number,
  oldPrice: Number,
  image: String
})

const emit = defineEmits(['buy'])

function formatPrice(price) {
  return price.toLocaleString('vi-VN')
}

function handleBuy() {
  emit('buy')
}
</script>

<style scoped>
.product-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.product-card img {
  max-width: 100%;
  height: 150px;
  object-fit: cover;
}

.price {
  color: #e53935;
  font-weight: bold;
  font-size: 18px;
}

.old-price {
  text-decoration: line-through;
  color: #999;
}

button {
  background-color: #1976d2;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #1565c0;
}
</style>
