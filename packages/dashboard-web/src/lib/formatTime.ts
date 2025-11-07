export function formatResetTime(resetTimestamp: number | null): string {
	if (!resetTimestamp) return "Unknown";

	const now = Date.now();
	const resetMs = resetTimestamp * 1000; // Convert to milliseconds
	const diffMs = resetMs - now;

	if (diffMs <= 0) return "Resetting soon";

	const hours = Math.floor(diffMs / (1000 * 60 * 60));
	const days = Math.floor(hours / 24);

	if (days > 0) {
		const remainingHours = hours % 24;
		if (remainingHours > 0) {
			return `${days}d ${remainingHours}h`;
		}
		return `${days} day${days !== 1 ? "s" : ""}`;
	}

	if (hours > 0) {
		const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
		if (minutes > 0) {
			return `${hours}h ${minutes}m`;
		}
		return `${hours} hour${hours !== 1 ? "s" : ""}`;
	}

	const minutes = Math.floor(diffMs / (1000 * 60));
	return `${minutes} min${minutes !== 1 ? "s" : ""}`;
}

export function formatNumber(num: number): string {
	if (num >= 1_000_000) {
		return `${(num / 1_000_000).toFixed(1)}M`;
	}
	if (num >= 1_000) {
		return `${(num / 1_000).toFixed(1)}K`;
	}
	return num.toString();
}
