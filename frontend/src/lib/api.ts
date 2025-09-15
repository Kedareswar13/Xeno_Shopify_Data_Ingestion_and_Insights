import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { toast } from 'react-hot-toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
const DEBUG_API = (process.env.NEXT_PUBLIC_DEBUG_API === 'true');

// Cache for GET requests
const requestCache = new Map<string, Promise<any>>();

// Generate a unique key for each request
const generateRequestKey = (config: AxiosRequestConfig) => {
  return `${config.method}:${config.url}:${JSON.stringify(config.params)}`;
};

interface PendingRequest {
  promise: Promise<any>;
  controller: AbortController;
}

class ApiClient {
  private client: AxiosInstance;
  private pendingRequests: Map<string, PendingRequest>;
  private static lastAuthRedirectAt = 0;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });
    
    this.pendingRequests = new Map();

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Only run this in the browser
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('token');
          if (token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${token}`;
            if (DEBUG_API) {
              console.log('Adding auth token to request:', { 
                url: config.url,
                hasToken: !!token 
              });
            }
          }
          
          // Add cancel token for the request
          const controller = new AbortController();
          config.signal = controller.signal;
          
          // Store the request for potential cancellation
          const requestKey = generateRequestKey(config);
          const pendingRequest = this.pendingRequests.get(requestKey);
          
          if (pendingRequest) {
            // Cancel the previous request if it's still pending
            pendingRequest.controller.abort('Cancelled duplicate request');
          }
          
          // Create a promise that will be resolved with the config
          // This allows us to track the request in the pendingRequests map
          const requestPromise = new Promise<typeof config>((resolve) => {
            resolve(config);
          });
          
          this.pendingRequests.set(requestKey, {
            promise: requestPromise,
            controller
          });
        }
        return config;
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Clean up pending requests
        if (response?.config) {
          const requestKey = generateRequestKey(response.config);
          this.pendingRequests.delete(requestKey);

          // Cache GET responses
          if (response.config.method?.toLowerCase() === 'get') {
            const cacheKey = generateRequestKey(response.config);
            requestCache.set(cacheKey, Promise.resolve(response.data));
            
            // Set cache expiration (5 minutes)
            setTimeout(() => {
              requestCache.delete(cacheKey);
            }, 5 * 60 * 1000);
          }
        }

        // Log successful responses for debugging
        if (process.env.NODE_ENV === 'development') {
          if (DEBUG_API) console.log('API Success:', {
            url: response.config?.url,
            status: response.status,
            data: response.data
          });
        }
        return response;
      },
      (error: unknown) => {
        // Clean up pending requests on error
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          if (axiosError.config) {
            const requestKey = generateRequestKey(axiosError.config);
            this.pendingRequests.delete(requestKey);
          }

          // Don't log cancelled requests
          if (axios.isCancel(error)) {
            return Promise.reject(error);
          }

          // Log detailed error information
          const errorData = {
            message: axiosError.message,
            url: axiosError.config?.url,
            method: axiosError.config?.method,
            status: axiosError.response?.status,
            statusText: axiosError.response?.statusText,
            responseData: axiosError.response?.data,
            config: {
              headers: axiosError.config?.headers as Record<string, unknown>,
              baseURL: axiosError.config?.baseURL,
              timeout: axiosError.config?.timeout
            }
          };

          if (DEBUG_API) console.error('API Error:', JSON.stringify(errorData, null, 2));

          // Handle 401 Unauthorized errors (debounced to avoid redirect loops)
          if (axiosError.response?.status === 401) {
            console.warn('Authentication error - Invalid or expired token');
            if (typeof window !== 'undefined') {
              const now = Date.now();
              const cooldownMs = 4000; // 4s guard window
              const timeSinceLast = now - ApiClient.lastAuthRedirectAt;
              // Clear any invalid token
              localStorage.removeItem('token');
              // Only redirect if not already on login and outside cooldown window
              if (!window.location.pathname.includes('/login') && timeSinceLast > cooldownMs) {
                ApiClient.lastAuthRedirectAt = now;
                window.location.href = '/login';
              }
            }
          }
        } else if (error instanceof Error) {
          console.error('Non-Axios error:', error.message);
        } else {
          console.error('Unknown error occurred:', error);
        }

        return Promise.reject(error);
      }
    );
  }

  // Generic request method with caching and deduplication
  async request<T = any>(config: AxiosRequestConfig, useCache = true): Promise<T> {
    const requestKey = generateRequestKey(config);
    const isGetRequest = config.method?.toLowerCase() === 'get';

    // Check cache for GET requests
    if (isGetRequest && useCache && requestCache.has(requestKey)) {
      if (DEBUG_API) console.log('Returning cached response for:', requestKey);
      return requestCache.get(requestKey);
    }

    // Check for duplicate in-flight requests
    if (this.pendingRequests.has(requestKey)) {
      if (DEBUG_API) console.log('Deduplicating request:', requestKey);
      // Wait for the existing request to complete
      return this.pendingRequests.get(requestKey)!.promise as Promise<T>;
    }

    // Create a new request
    const controller = new AbortController();
    const requestPromise = this.client({
      ...config,
      signal: controller.signal,
      headers: {
        ...config.headers,
      },
    })
      .then((response: AxiosResponse<T>) => {
        // Cache successful GET responses
        if (isGetRequest && useCache) {
          requestCache.set(requestKey, Promise.resolve(response.data));
          // Set cache expiration (5 minutes)
          setTimeout(() => {
            requestCache.delete(requestKey);
          }, 5 * 60 * 1000);
        }
        return response.data;
      })
      .finally(() => {
        // Clean up pending request
        this.pendingRequests.delete(requestKey);
      });

    // Store the promise for deduplication
    this.pendingRequests.set(requestKey, {
      promise: requestPromise,
      controller,
    });

    return requestPromise.catch((error) => {
      // Clean up cache on error
      if (isGetRequest) {
        requestCache.delete(requestKey);
      }
      throw error;
    });
  }

  // HTTP Methods with caching and deduplication
  async get<T = any>(url: string, config: AxiosRequestConfig = {}, useCache = true): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url }, useCache);
  }

  async post<T = any>(
    url: string,
    data?: any,
    config: AxiosRequestConfig = {}
  ): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data }, false);
  }

  async put<T = any>(
    url: string,
    data?: any,
    config: AxiosRequestConfig = {}
  ): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, data }, false);
  }

  async delete<T = any>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url }, false);
  }

  async patch<T = any>(
    url: string,
    data?: any,
    config: AxiosRequestConfig = {}
  ): Promise<T> {
    return this.request<T>({ ...config, method: 'PATCH', url, data }, false);
  }
}

export const api = new ApiClient();
