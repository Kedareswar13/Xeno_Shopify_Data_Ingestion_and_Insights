import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  useInfiniteQuery, 
  UseInfiniteQueryOptions, 
  UseInfiniteQueryResult,
  InfiniteData,
  QueryKey,
  InfiniteQueryObserverResult
} from '@tanstack/react-query';

type FetchFn<T> = (page: number, pageSize: number) => Promise<{
  data: T[];
  hasMore: boolean;
  total?: number;
}>;

type PageParam = number;

type PageData<T> = {
  data: T[];
  hasMore: boolean;
  page: number;
};

interface UseInfiniteScrollOptions<T> {
  queryKey: QueryKey;
  fetchFn: FetchFn<T>;
  pageSize?: number;
  initialPage?: number;
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  onSuccess?: (data: T[]) => void;
  onError?: (error: unknown) => void;
  getNextPageParam?: (lastPage: PageData<T>, allPages: PageData<T>[]) => number | undefined;
}

interface QueryResult<T> {
  data: T[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  loadMore: () => void;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  refetch: () => Promise<void>;
}

export function useInfiniteScroll<T>({
  queryKey,
  fetchFn,
  pageSize = 20,
  initialPage = 1,
  enabled = true,
  refetchOnWindowFocus = false,
  onSuccess,
  onError,
  getNextPageParam,
}: UseInfiniteScrollOptions<T>): QueryResult<T> {
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  const fetchPage = useCallback(
    async ({ pageParam = initialPage }: { pageParam?: number } = {}) => {
      const { data, hasMore: morePages } = await fetchFn(pageParam || initialPage, pageSize);
      return { 
        data, 
        page: pageParam || initialPage, 
        hasMore: morePages 
      };
    },
    [fetchFn, pageSize, initialPage]
  );

  const defaultGetNextPageParam = useCallback((lastPage: PageData<T>) => {
    return lastPage.hasMore ? lastPage.page + 1 : undefined;
  }, []);

  const queryOptions: UseInfiniteQueryOptions<PageData<T>, Error, PageData<T>, PageData<T>, QueryKey> = {
    queryKey,
    queryFn: fetchPage,
    getNextPageParam: getNextPageParam || defaultGetNextPageParam,
    enabled,
    refetchOnWindowFocus,
  };

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    isFetchingNextPage,
    hasNextPage = false,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery(queryOptions);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const currentRef = loadMoreRef.current;
    if (!currentRef || !hasMore) return;

    if (observer.current) {
      observer.current.disconnect();
    }

    const handleObserver: IntersectionObserverCallback = (entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) {
        loadMore();
      }
    };

    observer.current = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '20px',
      threshold: 0.1,
    });

    observer.current.observe(currentRef);

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [loadMore, hasMore, isFetchingNextPage]);

  // Reset pagination when query key changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setHasMore(true);
    refetch();
  }, [queryKey, initialPage, refetch]);

  // Update hasMore state when data changes
  useEffect(() => {
    if (data?.pages?.length) {
      const lastPage = data.pages[data.pages.length - 1];
      setHasMore(lastPage?.hasMore ?? false);
    }
  }, [data]);

  // Call onSuccess when data changes
  useEffect(() => {
    if (data?.pages) {
      const allItems = data.pages.flatMap(page => page.data);
      onSuccess?.(allItems);
    }
  }, [data, onSuccess]);

  // Flatten all pages data
  const allData = data?.pages.flatMap(page => page.data) || [];

  return {
    data: allData,
    isLoading: isLoading || isFetching,
    isError,
    error,
    isFetching,
    isFetchingNextPage,
    hasNextPage: hasMore && hasNextPage,
    loadMore,
    loadMoreRef: loadMoreRef as React.RefObject<HTMLDivElement>,
    refetch: async () => {
      await refetch();
    }
  };
}

export default useInfiniteScroll;
