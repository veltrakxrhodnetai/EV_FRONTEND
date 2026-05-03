import axios, { InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '../config/endpoints';

const api = axios.create({
	baseURL: API_BASE_URL,
	headers: {
		'Content-Type': 'application/json',
		'ngrok-skip-browser-warning': 'true',
	},
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
	const customerToken = localStorage.getItem('authToken');
	const ownerToken = localStorage.getItem('ownerAuthToken');
	const adminToken = localStorage.getItem('adminAuthToken');
	const url = config.url ?? '';

	let token: string | null = null;
	if (url.includes('/api/sessions/owner') || url.includes('/api/owner')) {
		token = ownerToken || adminToken || customerToken;
	} else if (url.includes('/api/admin')) {
		token = adminToken || ownerToken || customerToken;
	} else {
		token = customerToken || ownerToken || adminToken;
	}

	if (token) {
		config.headers = config.headers ?? {};
		config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
	}

	return config;
});

export default api;
