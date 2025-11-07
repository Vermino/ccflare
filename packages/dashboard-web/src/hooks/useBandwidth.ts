import { useQuery } from "@tanstack/react-query";

interface BandwidthData {
	success: boolean;
	data: {
		totalAccounts: number;
		healthyAccounts: number;
		warningAccounts: number;
		criticalAccounts: number;
		rateLimitedAccounts: number;
		totalImmediateCapacity: {
			requests: number;
			tokens: number;
		};
		nextResetTimes: Array<{
			accountId: string;
			accountName: string;
			resetTime: number;
			secondsUntilReset: number;
		}>;
		accountStatuses: Array<{
			accountId: string;
			accountName: string;
			tier: number;
			status: "healthy" | "warning" | "critical" | "rate_limited";
			statusMessage: string;
			immediateCapacity: {
				requests: number;
				tokens: number;
			};
		}>;
	};
	timestamp: string;
}

export function useBandwidthSummary() {
	return useQuery<BandwidthData>({
		queryKey: ["bandwidth", "summary"],
		queryFn: async () => {
			const response = await fetch("/api/bandwidth/summary");
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return response.json();
		},
		refetchInterval: 30000, // Refetch every 30 seconds
		staleTime: 10000, // Consider data stale after 10 seconds
	});
}

export function useBandwidthForAccount(accountId: string) {
	return useQuery({
		queryKey: ["bandwidth", "account", accountId],
		queryFn: async () => {
			const response = await fetch(`/api/bandwidth/${accountId}`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return response.json();
		},
		refetchInterval: 30000,
		staleTime: 10000,
		enabled: !!accountId,
	});
}
