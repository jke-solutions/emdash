import {
	Badge,
	Button,
	Dialog,
	Input,
	InputArea,
	Label,
	Loader,
	LinkButton,
	Select,
	Switch,
	Toast,
} from "@cloudflare/kumo";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { CheckCircle, Plus, Trash } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import {
	confirmShopPayment,
	createShopDeliveryZone,
	createShopCoupon,
	deleteShopCoupon,
	fetchShopCoupons,
	deleteShopDeliveryZone,
	fetchShopDeliveryZones,
	updateShopDeliveryZone,
	type ShopCoupon,
	fetchShopCustomers,
	fetchShopOrder,
	fetchShopOrderWhatsAppUrl,
	fetchShopOrders,
	fetchShopSettings,
	fetchShopBookingHours,
	fetchShopReservations,
	type ShopSettingsUpdateInput,
	type ShopDeliveryZone,
	type ShopCustomerSummary,
	type ShopReservationSummary,
	type ShopOrderDetail,
	type ShopOrderSummary,
	type ShopSettings,
	updateShopDelivery,
	updateShopSettings,
	updateShopCoupon,
	updateShopBookingHours,
	updateShopReservation,
	fetchContentList,
} from "../lib/api/index.js";

type ShopTab = "settings" | "delivery" | "orders" | "customers" | "coupons" | "bookings";

const PAYMENT_METHODS = ["whatsapp", "yape", "plin", "bank_transfer", "cash_on_delivery"] as const;

function formatStatus(status: string, t: (descriptor: MessageDescriptor) => string): string {
	const labels: Record<string, MessageDescriptor> = {
		new: msg`New`,
		confirmed: msg`Confirmed`,
		preparing: msg`Preparing`,
		ready: msg`Ready for delivery`,
		in_transit: msg`In transit`,
		delivered: msg`Delivered`,
		cancelled: msg`Cancelled`,
		not_delivered: msg`Not delivered`,
		rescheduled: msg`Rescheduled`,
		pending: msg`Pending`,
	};
	const label = labels[status];
	return label ? t(label) : status;
}

function money(value: number, symbol: string): string {
	return `${symbol} ${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}

const BOOKING_DAYS = [
	msg`Sunday`,
	msg`Monday`,
	msg`Tuesday`,
	msg`Wednesday`,
	msg`Thursday`,
	msg`Friday`,
	msg`Saturday`,
] as const;

type BookingHourDraft = { weekday: number; startsAt: string; endsAt: string };

function emptyBookingHours(): BookingHourDraft[] {
	return BOOKING_DAYS.map((_, weekday) => ({ weekday, startsAt: "", endsAt: "" }));
}

function BookingSchedulePanel() {
	const { t } = useLingui();
	const toastManager = Toast.useToastManager();
	const servicesQuery = useQuery({
		queryKey: ["shop", "booking-services", "es"],
		queryFn: () => fetchContentList("products", { locale: "es", limit: 100 }),
	});
	const services = (servicesQuery.data?.items ?? []).filter((item) => {
		const itemType =
			typeof item.data.item_type === "string" ? item.data.item_type.toLowerCase() : "";
		const requiresBooking = item.data.requires_booking;
		return (
			itemType === "service" &&
			(requiresBooking === true ||
				requiresBooking === 1 ||
				requiresBooking === "1" ||
				requiresBooking === "true")
		);
	});
	const [serviceId, setServiceId] = React.useState("");
	const [dialogOpen, setDialogOpen] = React.useState(false);
	const [search, setSearch] = React.useState("");
	const [validFrom, setValidFrom] = React.useState("");
	const [validUntil, setValidUntil] = React.useState("");
	const [hours, setHours] = React.useState<BookingHourDraft[]>(emptyBookingHours);
	const [selectedWeekdays, setSelectedWeekdays] = React.useState<number[]>([]);
	const [scheduleError, setScheduleError] = React.useState<string | null>(null);
	const hoursQuery = useQuery({
		queryKey: ["shop", "booking-hours", serviceId],
		queryFn: () => fetchShopBookingHours(serviceId),
		enabled: Boolean(serviceId),
	});
	React.useEffect(() => {
		const next = emptyBookingHours();
		for (const hour of hoursQuery.data ?? []) {
			const row = next[hour.weekday];
			if (row) {
				row.startsAt = hour.startsAt;
				row.endsAt = hour.endsAt;
			}
		}
		setHours(next);
		setSelectedWeekdays(
			(hoursQuery.data ?? [])
				.map((hour) => hour.weekday)
				.filter((weekday, index, weekdays) => weekdays.indexOf(weekday) === index)
				.toSorted((a, b) => a - b),
		);
		const first = hoursQuery.data?.[0];
		setValidFrom(first?.validFrom ?? "");
		setValidUntil(first?.validUntil ?? "");
		setScheduleError(null);
	}, [hoursQuery.data]);
	const saveMutation = useMutation({
		mutationFn: () =>
			updateShopBookingHours(
				serviceId,
				hours.filter(
					(hour) => selectedWeekdays.includes(hour.weekday) && hour.startsAt && hour.endsAt,
				),
				validFrom || null,
				validUntil || null,
			),
		onSuccess: () => {
			setDialogOpen(false);
			toastManager.add({ title: t`Booking schedule saved`, type: "success" });
		},
	});

	if (servicesQuery.isLoading) return <LoadingState label={t`Loading services`} />;
	if (services.length === 0) {
		return (
			<div className="rounded-lg border p-6">
				<p className="text-sm text-kumo-subtle">{t`No bookable services found.`}</p>
				<p className="mt-2 text-sm text-kumo-subtle">
					{t`Create a service to configure its availability and accept bookings.`}
				</p>
				<LinkButton
					href="/_emdash/admin/content/products/new?locale=es&itemType=service"
					className="mt-4"
					icon={<Plus />}
				>
					{t`Add service`}
				</LinkButton>
			</div>
		);
	}
	const normalizedSearch = search.trim().toLowerCase();
	const visibleServices = services.filter((service) => {
		const name =
			typeof service.data.name === "string" ? service.data.name : (service.slug ?? service.id);
		return !normalizedSearch || name.toLowerCase().includes(normalizedSearch);
	});
	const openSchedule = (id: string) => {
		setServiceId(id);
		setDialogOpen(true);
	};
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<div className="min-w-[240px] flex-1">
					<Input
						label={t`Search services`}
						placeholder={t`Search by service name`}
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
				</div>
			</div>
			<div className="overflow-x-auto rounded-lg border border-kumo-line">
				<table className="w-full text-start">
					<thead className="border-b border-kumo-line bg-kumo-tint">
						<tr>
							<th className="p-3 text-start text-sm font-medium">{t`Service`}</th>
							<th className="p-3 text-start text-sm font-medium">{t`Type`}</th>
							<th className="p-3 text-start text-sm font-medium">{t`Duration`}</th>
							<th className="p-3 text-start text-sm font-medium">{t`Capacity`}</th>
							<th className="p-3 text-end text-sm font-medium">{t`Actions`}</th>
						</tr>
					</thead>
					<tbody>
						{visibleServices.map((service) => {
							const name =
								typeof service.data.name === "string"
									? service.data.name
									: (service.slug ?? service.id);
							return (
								<tr
									key={service.id}
									className="border-b border-kumo-line last:border-0 hover:bg-kumo-tint"
								>
									<td className="p-3 font-medium">{name}</td>
									<td className="p-3">
										{service.data.service_mode === "online" ? t`Online` : t`In person`}
									</td>
									<td className="p-3">
										{typeof service.data.duration_minutes === "number"
											? `${service.data.duration_minutes} min`
											: t`Not set`}
									</td>
									<td className="p-3">
										{typeof service.data.service_capacity === "number"
											? service.data.service_capacity
											: 1}
									</td>
									<td className="p-3 text-end">
										<Button
											size="sm"
											variant="outline"
											onClick={() => openSchedule(service.id)}
										>{t`Schedule`}</Button>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			{visibleServices.length === 0 ? (
				<p className="rounded-lg border p-6 text-sm text-kumo-subtle">{t`No services match your search.`}</p>
			) : null}
			<Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
				<Dialog
					className="max-h-[90vh] w-[min(720px,calc(100vw-2rem))] overflow-y-auto p-6"
					size="lg"
				>
					<div className="mb-4 flex items-center justify-between gap-4">
						<Dialog.Title className="text-lg font-semibold">{t`Schedule service availability`}</Dialog.Title>
						<Dialog.Close
							aria-label={t`Close`}
							render={(props) => (
								<Button {...props} aria-label={t`Close`} variant="ghost" shape="square">
									×
								</Button>
							)}
						/>
					</div>
					<form
						className="space-y-5"
						onSubmit={(event) => {
							event.preventDefault();
							const incomplete = hours.some(
								(hour) =>
									selectedWeekdays.includes(hour.weekday) && (!hour.startsAt || !hour.endsAt),
							);
							if (selectedWeekdays.length === 0) {
								setScheduleError(t`Select at least one available day.`);
								return;
							}
							if (incomplete) {
								setScheduleError(t`Add a start and end time for each selected day.`);
								return;
							}
							setScheduleError(null);
							saveMutation.mutate();
						}}
					>
						<div className="grid gap-4 sm:grid-cols-2">
							<Input
								label={t`Start date`}
								type="date"
								value={validFrom}
								onChange={(event) => setValidFrom(event.target.value)}
								required
							/>
							<Input
								label={t`End date`}
								type="date"
								value={validUntil}
								onChange={(event) => setValidUntil(event.target.value)}
								required
							/>
						</div>
						<p className="text-sm text-kumo-subtle">{t`Choose the date range in which this weekly schedule can be booked. Days outside the selected range or selected weekdays are unavailable.`}</p>
						<div>
							<Label>{t`Available days`}</Label>
							<p className="mt-1 text-sm text-kumo-subtle">{t`Select only the days when this service is available. Saturday and Sunday can be left unselected.`}</p>
							<div className="mt-3 flex flex-wrap gap-2">
								{BOOKING_DAYS.map((day, weekday) => {
									const selected = selectedWeekdays.includes(weekday);
									return (
										<Button
											key={weekday}
											type="button"
											size="sm"
											variant={selected ? "primary" : "outline"}
											aria-pressed={selected}
											onClick={() =>
												setSelectedWeekdays((current) =>
													selected
														? current.filter((value) => value !== weekday)
														: [...current, weekday].toSorted((a, b) => a - b),
												)
											}
										>
											{t(day)}
										</Button>
									);
								})}
							</div>
						</div>
						<div className="space-y-3">
							{hours
								.filter((hour) => selectedWeekdays.includes(hour.weekday))
								.map((hour) => (
									<div
										key={hour.weekday}
										className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr]"
									>
										<Label>{t(BOOKING_DAYS[hour.weekday]!)}</Label>
										<Input
											label={t`Starts at`}
											type="time"
											value={hour.startsAt}
											onChange={(event) =>
												setHours((current) =>
													current.map((item) =>
														item.weekday === hour.weekday
															? { ...item, startsAt: event.target.value }
															: item,
													),
												)
											}
										/>
										<Input
											label={t`Ends at`}
											type="time"
											value={hour.endsAt}
											onChange={(event) =>
												setHours((current) =>
													current.map((item) =>
														item.weekday === hour.weekday
															? { ...item, endsAt: event.target.value }
															: item,
													),
												)
											}
										/>
									</div>
								))}
						</div>
						{scheduleError ? <p className="text-sm text-kumo-danger">{scheduleError}</p> : null}
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setDialogOpen(false)}
							>{t`Cancel`}</Button>
							<Button type="submit" disabled={saveMutation.isPending}>
								{saveMutation.isPending ? t`Saving…` : t`Save schedule`}
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>
		</div>
	);
}

function ReservationsPanel() {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const [status, setStatus] = React.useState("all");
	const reservationsQuery = useQuery({
		queryKey: ["shop", "reservations", status],
		queryFn: () => fetchShopReservations(status),
	});
	const [selectedReservation, setSelectedReservation] =
		React.useState<ShopReservationSummary | null>(null);
	const orderDetailQuery = useQuery({
		queryKey: ["shop", "reservation-order", selectedReservation?.orderId],
		queryFn: () => fetchShopOrder(selectedReservation?.orderId ?? ""),
		enabled: selectedReservation?.orderId !== null && selectedReservation?.orderId !== undefined,
	});
	const updateMutation = useMutation({
		mutationFn: ({ id, nextStatus }: { id: string; nextStatus: string }) =>
			updateShopReservation(id, nextStatus),
		onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["shop", "reservations"] }),
	});
	const reservations = reservationsQuery.data ?? [];
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-xl font-semibold">{t`Reservations`}</h2>
					<p className="mt-1 text-sm text-kumo-subtle">{t`Review and update service bookings.`}</p>
				</div>
				<Select
					aria-label={t`Filter reservations by status`}
					value={status}
					onValueChange={(value) => value && setStatus(value)}
					items={{
						all: t`All statuses`,
						held: t`Held`,
						pending_payment: t`Pending payment`,
						confirmed: t`Confirmed`,
						cancelled: t`Cancelled`,
						completed: t`Completed`,
						no_show: t`No show`,
					}}
				/>
			</div>
			{reservationsQuery.isLoading ? <LoadingState label={t`Loading reservations`} /> : null}
			{!reservationsQuery.isLoading && reservations.length === 0 ? (
				<p className="rounded-lg border p-6 text-sm text-kumo-subtle">{t`No reservations found.`}</p>
			) : null}
			{reservations.length > 0 ? (
				<div className="overflow-x-auto rounded-lg border border-kumo-line">
					<table className="w-full text-start">
						<thead className="border-b border-kumo-line bg-kumo-tint">
							<tr>
								<th className="p-3 text-start text-sm font-medium">{t`Service`}</th>
								<th className="p-3 text-start text-sm font-medium">{t`Customer`}</th>
								<th className="p-3 text-start text-sm font-medium">{t`Date and time`}</th>
								<th className="p-3 text-start text-sm font-medium">{t`Status`}</th>
								<th className="p-3 text-end text-sm font-medium">{t`Order`}</th>
								<th className="p-3 text-end text-sm font-medium">{t`Actions`}</th>
							</tr>
						</thead>
						<tbody>
							{reservations.map((reservation) => (
								<tr key={reservation.id} className="border-b border-kumo-line last:border-0">
									<td className="p-3 font-medium">
										{reservation.serviceName ?? reservation.serviceId}
									</td>
									<td className="p-3">{reservation.customerName ?? t`Customer`}</td>
									<td className="p-3 text-sm">
										{new Intl.DateTimeFormat(undefined, {
											dateStyle: "medium",
											timeStyle: "short",
											timeZone: "UTC",
										}).format(new Date(reservation.startsAt))}
									</td>
									<td className="p-3">
										<Select
											aria-label={t`Update reservation status`}
											value={reservation.status}
											onValueChange={(nextStatus) =>
												nextStatus && updateMutation.mutate({ id: reservation.id, nextStatus })
											}
											items={{
												held: t`Held`,
												pending_payment: t`Pending payment`,
												confirmed: t`Confirmed`,
												cancelled: t`Cancelled`,
												expired: t`Expired`,
												completed: t`Completed`,
												no_show: t`No show`,
											}}
										/>
									</td>
									<td className="p-3 text-end">{reservation.orderId ?? "—"}</td>
									<td className="p-3 text-end">
										<div className="flex flex-wrap justify-end gap-2">
											<Button
												type="button"
												size="sm"
												variant="outline"
												onClick={() => setSelectedReservation(reservation)}
											>
												{t`View details`}
											</Button>
											{!["cancelled", "expired", "completed", "no_show"].includes(
												reservation.status,
											) ? (
												<Button
													type="button"
													size="sm"
													variant="outline"
													disabled={updateMutation.isPending}
													onClick={() =>
														updateMutation.mutate({ id: reservation.id, nextStatus: "cancelled" })
													}
												>
													{t`Cancel`}
												</Button>
											) : null}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}
			<Dialog.Root
				open={selectedReservation !== null}
				onOpenChange={(open) => !open && setSelectedReservation(null)}
			>
				<Dialog
					className="max-h-[90vh] w-[min(640px,calc(100vw-2rem))] overflow-y-auto p-6"
					size="lg"
				>
					<div className="mb-4 flex items-center justify-between gap-4">
						<Dialog.Title className="text-lg font-semibold">{t`Reservation details`}</Dialog.Title>
						<Dialog.Close
							aria-label={t`Close`}
							render={(props) => (
								<Button {...props} aria-label={t`Close`} variant="ghost" shape="square">
									×
								</Button>
							)}
						/>
					</div>
					{selectedReservation ? (
						<div className="grid gap-3 sm:grid-cols-2">
							{(
								[
									[t`Service`, selectedReservation.serviceName ?? selectedReservation.serviceId],
									[t`Customer`, selectedReservation.customerName ?? t`Customer`],
									[
										t`Starts at`,
										new Intl.DateTimeFormat(undefined, {
											dateStyle: "medium",
											timeStyle: "short",
											timeZone: "UTC",
										}).format(new Date(selectedReservation.startsAt)),
									],
									[
										t`Ends at`,
										new Intl.DateTimeFormat(undefined, {
											dateStyle: "medium",
											timeStyle: "short",
											timeZone: "UTC",
										}).format(new Date(selectedReservation.endsAt)),
									],
									[t`Status`, formatStatus(selectedReservation.status, t)],
									[t`Order`, selectedReservation.orderId ?? "—"],
								] as const
							).map(([label, value]) => (
								<div key={label} className="rounded-lg border border-kumo-line p-3">
									<p className="text-sm text-kumo-subtle">{label}</p>
									<p className="mt-1">{value}</p>
								</div>
							))}
							{selectedReservation.orderId ? (
								<div className="mt-4 sm:col-span-2">
									<h3 className="mb-2 font-medium">{t`Products in the order`}</h3>
									{orderDetailQuery.isLoading ? (
										<LoadingState label={t`Loading order details`} />
									) : null}
									{orderDetailQuery.data ? (
										<div className="space-y-2">
											{orderDetailQuery.data.items.map((item) => (
												<div
													key={item.id}
													className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-kumo-line p-3 text-sm"
												>
													<div>
														<p className="font-medium">{item.productName}</p>
														{item.variantName ? (
															<p className="text-kumo-subtle">{item.variantName}</p>
														) : null}
													</div>
													<span>
														{item.quantity} ×{" "}
														{money(item.unitPrice, orderDetailQuery.data.currencySymbol)} ={" "}
														{money(item.subtotal, orderDetailQuery.data.currencySymbol)}
													</span>
												</div>
											))}
										</div>
									) : null}
									{orderDetailQuery.data ? (
										<div className="mt-4">
											<h3 className="mb-2 font-medium">{t`Customer details`}</h3>
											<div className="grid gap-3 sm:grid-cols-2">
												{(
													[
														[t`Name`, orderDetailQuery.data.customer.name],
														[t`Phone`, orderDetailQuery.data.customer.phone],
														[t`Email`, orderDetailQuery.data.customer.email],
														[t`Address`, orderDetailQuery.data.customer.address],
														[t`District`, orderDetailQuery.data.customer.district],
														[t`Reference`, orderDetailQuery.data.customer.reference],
													] as const
												)
													.filter(
														([, value]) => value !== null && value !== undefined && value !== "",
													)
													.map(([label, value]) => (
														<div key={label} className="rounded-lg border border-kumo-line p-3">
															<p className="text-sm text-kumo-subtle">{label}</p>
															<p className="mt-1 break-words">{String(value)}</p>
														</div>
													))}
											</div>
										</div>
									) : null}
								</div>
							) : null}
						</div>
					) : null}
				</Dialog>
			</Dialog.Root>
		</div>
	);
}

export function Shop() {
	const { t } = useLingui();
	const [tab, setTab] = React.useState<ShopTab>("settings");

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold leading-tight">{t`Ecommerce`}</h1>
				<p className="mt-1 text-sm text-kumo-subtle">{t`Manage your products, delivery settings, and orders.`}</p>
			</div>
			<div className="flex flex-wrap gap-2 border-b border-kumo-line">
				{(
					[
						["settings", t`Store settings`],
						["delivery", t`Delivery zones`],
						["orders", t`Orders`],
						["customers", t`Customers`],
						["coupons", t`Coupons`],
						["bookings", t`Bookings`],
					] as const
				).map(([value, label]) => (
					<Button
						key={value}
						variant={tab === value ? "secondary" : "ghost"}
						onClick={() => setTab(value)}
					>
						{label}
					</Button>
				))}
			</div>
			{tab === "settings" ? <ShopSettingsPanel /> : null}
			{tab === "delivery" ? <DeliveryZonesPanel /> : null}
			{tab === "orders" ? <OrdersPanel /> : null}
			{tab === "customers" ? <CustomersPanel /> : null}
			{tab === "coupons" ? <CouponsPanel /> : null}
			{tab === "bookings" ? <BookingSchedulePanel /> : null}
			{tab === "bookings" ? <ReservationsPanel /> : null}
		</div>
	);
}

function CouponsPanel() {
	const { t } = useLingui();
	const toastManager = Toast.useToastManager();
	const queryClient = useQueryClient();
	const couponsQuery = useQuery({ queryKey: ["shop", "coupons"], queryFn: fetchShopCoupons });
	const [form, setForm] = React.useState({
		code: "",
		discountType: "percentage" as "percentage" | "fixed",
		discountValue: "",
		minimumSubtotal: "0",
		usageLimit: "",
	});
	const [editing, setEditing] = React.useState<ShopCoupon | null>(null);
	const [dialogOpen, setDialogOpen] = React.useState(false);
	const [search, setSearch] = React.useState("");
	const saveMutation = useMutation({
		mutationFn: () => {
			const input = {
				code: form.code,
				discountType: form.discountType,
				discountValue: Number(form.discountValue),
				minimumSubtotal: Number(form.minimumSubtotal) || 0,
				usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
				active: true,
			};
			return editing ? updateShopCoupon(editing.id, input) : createShopCoupon(input);
		},
		onSuccess: () => {
			setForm({
				code: "",
				discountType: "percentage",
				discountValue: "",
				minimumSubtotal: "0",
				usageLimit: "",
			});
			setEditing(null);
			setDialogOpen(false);
			void queryClient.invalidateQueries({ queryKey: ["shop", "coupons"] });
			toastManager.add({ title: t`Coupon saved`, type: "success" });
		},
	});
	const deleteMutation = useMutation({
		mutationFn: deleteShopCoupon,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["shop", "coupons"] });
			toastManager.add({ title: t`Coupon deleted`, type: "success" });
		},
	});
	if (couponsQuery.isLoading) return <LoadingState label={t`Loading coupons`} />;
	if (couponsQuery.isError)
		return <ErrorState label={t`Could not load coupons. Please try again.`} />;
	const normalizedSearch = search.trim().toLowerCase();
	const coupons = (couponsQuery.data ?? []).filter(
		(coupon) => !normalizedSearch || coupon.code.toLowerCase().includes(normalizedSearch),
	);
	const openCreate = () => {
		setEditing(null);
		setForm({
			code: "",
			discountType: "percentage",
			discountValue: "",
			minimumSubtotal: "0",
			usageLimit: "",
		});
		setDialogOpen(true);
	};
	const openEdit = (coupon: ShopCoupon) => {
		setEditing(coupon);
		setForm({
			code: coupon.code,
			discountType: coupon.discountType,
			discountValue: String(coupon.discountValue),
			minimumSubtotal: String(coupon.minimumSubtotal),
			usageLimit: coupon.usageLimit === null ? "" : String(coupon.usageLimit),
		});
		setDialogOpen(true);
	};
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<div className="min-w-[240px] flex-1">
					<Input
						label={t`Search coupons`}
						placeholder={t`Search by coupon code`}
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
				</div>
				<Button icon={Plus} onClick={openCreate}>{t`New coupon`}</Button>
			</div>
			<div className="overflow-x-auto rounded-lg border border-kumo-line">
				<table className="w-full text-start">
					<thead className="border-b border-kumo-line bg-kumo-tint">
						<tr>
							<th className="p-3 text-start text-sm font-medium">{t`Code`}</th>
							<th className="p-3 text-start text-sm font-medium">{t`Discount`}</th>
							<th className="p-3 text-end text-sm font-medium">{t`Uses`}</th>
							<th className="p-3 text-end text-sm font-medium">{t`Actions`}</th>
						</tr>
					</thead>
					<tbody>
						{coupons.map((coupon) => (
							<tr
								key={coupon.id}
								className="border-b border-kumo-line last:border-0 hover:bg-kumo-tint"
							>
								<td className="p-3 font-medium">{coupon.code}</td>
								<td className="p-3">
									{coupon.discountType === "percentage"
										? `${coupon.discountValue}%`
										: money(coupon.discountValue, "")}
								</td>
								<td className="p-3 text-end">
									{coupon.usageLimit === null
										? t`Unlimited`
										: `${coupon.usageCount}/${coupon.usageLimit}`}
								</td>
								<td className="p-3 text-end">
									<div className="flex justify-end gap-2">
										<Button
											size="sm"
											variant="outline"
											onClick={() => openEdit(coupon)}
										>{t`Edit`}</Button>
										<Button
											size="sm"
											variant="ghost"
											onClick={() => deleteMutation.mutate(coupon.id)}
										>{t`Delete`}</Button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{coupons.length === 0 ? (
				<p className="rounded-lg border p-6 text-sm text-kumo-subtle">{t`No coupons match your search.`}</p>
			) : null}
			<Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
				<Dialog
					className="max-h-[90vh] w-[min(560px,calc(100vw-2rem))] overflow-y-auto p-6"
					size="lg"
				>
					<div className="mb-4 flex items-center justify-between gap-4">
						<Dialog.Title className="text-lg font-semibold">
							{editing ? t`Edit coupon` : t`New coupon`}
						</Dialog.Title>
						<Dialog.Close
							aria-label={t`Close`}
							render={(props) => (
								<Button {...props} aria-label={t`Close`} variant="ghost" shape="square">
									×
								</Button>
							)}
						/>
					</div>
					<form
						className="space-y-4"
						onSubmit={(event) => {
							event.preventDefault();
							saveMutation.mutate();
						}}
					>
						<Input
							label={t`Code`}
							value={form.code}
							onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
							required
						/>
						<Select
							label={t`Discount type`}
							value={form.discountType}
							onValueChange={(value) =>
								(value === "percentage" || value === "fixed") &&
								setForm({ ...form, discountType: value })
							}
							items={{ percentage: t`Percentage`, fixed: t`Fixed amount` }}
						/>
						<Input
							label={form.discountType === "percentage" ? t`Percentage` : t`Amount`}
							type="number"
							min="0"
							value={form.discountValue}
							onChange={(event) => setForm({ ...form, discountValue: event.target.value })}
							required
						/>
						<Input
							label={t`Minimum subtotal`}
							type="number"
							min="0"
							value={form.minimumSubtotal}
							onChange={(event) => setForm({ ...form, minimumSubtotal: event.target.value })}
						/>
						<Input
							label={t`Usage limit`}
							type="number"
							min="1"
							value={form.usageLimit}
							onChange={(event) => setForm({ ...form, usageLimit: event.target.value })}
							placeholder={t`Unlimited`}
						/>
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setDialogOpen(false)}
							>{t`Cancel`}</Button>
							<Button type="submit" disabled={saveMutation.isPending}>
								{saveMutation.isPending ? t`Saving...` : t`Save coupon`}
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>
		</div>
	);
}

function ShopSettingsPanel() {
	const { t } = useLingui();
	const toastManager = Toast.useToastManager();
	const queryClient = useQueryClient();
	const settingsQuery = useQuery({ queryKey: ["shop", "settings"], queryFn: fetchShopSettings });
	const [form, setForm] = React.useState<ShopSettings | null>(null);
	const [gatewaySecrets, setGatewaySecrets] = React.useState({ secretKey: "", webhookSecret: "" });

	React.useEffect(() => {
		if (settingsQuery.data) setForm(settingsQuery.data);
	}, [settingsQuery.data]);

	const saveMutation = useMutation({
		mutationFn: (input: ShopSettingsUpdateInput) => updateShopSettings(input),
		onSuccess: (settings) => {
			setForm(settings);
			setGatewaySecrets({ secretKey: "", webhookSecret: "" });
			void queryClient.invalidateQueries({ queryKey: ["shop", "settings"] });
			toastManager.add({ title: t`Store settings saved`, type: "success" });
		},
	});

	if (settingsQuery.isLoading || !form) return <LoadingState label={t`Loading store settings`} />;

	const togglePaymentMethod = (method: string, enabled: boolean) => {
		setForm((current) => {
			if (!current) return current;
			const paymentMethods = enabled
				? [...new Set([...current.paymentMethods, method])]
				: current.paymentMethods.filter((item) => item !== method);
			return { ...current, paymentMethods };
		});
	};

	return (
		<form
			className="max-w-5xl space-y-4"
			onSubmit={(event) => {
				event.preventDefault();
				saveMutation.mutate({
					...form,
					paymentGatewaySecretKey: gatewaySecrets.secretKey || undefined,
					paymentGatewayWebhookSecret: gatewaySecrets.webhookSecret || undefined,
				});
			}}
		>
			<div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
				<Input
					label={t`Store name`}
					value={form.storeName}
					onChange={(e) => setForm({ ...form, storeName: e.target.value })}
					required
				/>
				<Input
					label={t`Currency`}
					value={form.currency}
					onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
					maxLength={3}
					required
				/>
				<Input
					label={t`Currency symbol`}
					value={form.currencySymbol}
					onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
					maxLength={8}
					placeholder={t`Example: S/`}
					required
				/>
			</div>
			<div className="max-w-3xl space-y-2">
				<Label>{t`WhatsApp number`}</Label>
				<Input
					value={form.whatsappNumber ?? ""}
					onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value || null })}
					placeholder={t`Example: 51999999999`}
				/>
				<p className="text-sm text-kumo-subtle">{t`Use the country code without spaces or symbols.`}</p>
			</div>
			<div className="max-w-4xl space-y-3 rounded-lg border border-kumo-line p-4">
				<div>
					<h2 className="font-semibold">{t`WhatsApp order message`}</h2>
					<p className="mt-1 text-sm text-kumo-subtle">{t`The store name, order number, products, and total are added automatically.`}</p>
				</div>
				<InputArea
					label={t`Message introduction`}
					value={form.whatsappMessage ?? ""}
					onChange={(e) => setForm({ ...form, whatsappMessage: e.target.value || null })}
					rows={4}
					placeholder={t`Hello, I want to coordinate payment for my order.`}
				/>
				<InputArea
					label={t`Order received template`}
					value={form.whatsappTemplates.orderReceived ?? ""}
					onChange={(e) =>
						setForm({
							...form,
							whatsappTemplates: {
								...form.whatsappTemplates,
								orderReceived: e.target.value,
							},
						})
					}
					rows={3}
					placeholder={t`Optional message used when the customer sends the order to WhatsApp.`}
				/>
				<InputArea
					label={t`Payment confirmed template`}
					value={form.whatsappTemplates.paymentConfirmed ?? ""}
					onChange={(e) =>
						setForm({
							...form,
							whatsappTemplates: { ...form.whatsappTemplates, paymentConfirmed: e.target.value },
						})
					}
					rows={2}
				/>
				<InputArea
					label={t`Preparing template`}
					value={form.whatsappTemplates.preparing ?? ""}
					onChange={(e) =>
						setForm({
							...form,
							whatsappTemplates: { ...form.whatsappTemplates, preparing: e.target.value },
						})
					}
					rows={2}
				/>
				<InputArea
					label={t`In transit template`}
					value={form.whatsappTemplates.inTransit ?? ""}
					onChange={(e) =>
						setForm({
							...form,
							whatsappTemplates: { ...form.whatsappTemplates, inTransit: e.target.value },
						})
					}
					rows={2}
				/>
				<InputArea
					label={t`Delivered template`}
					value={form.whatsappTemplates.delivered ?? ""}
					onChange={(e) =>
						setForm({
							...form,
							whatsappTemplates: { ...form.whatsappTemplates, delivered: e.target.value },
						})
					}
					rows={2}
				/>
				<InputArea
					label={t`Cancelled template`}
					value={form.whatsappTemplates.cancelled ?? ""}
					onChange={(e) =>
						setForm({
							...form,
							whatsappTemplates: { ...form.whatsappTemplates, cancelled: e.target.value },
						})
					}
					rows={2}
				/>
				<div className="space-y-2">
					<Label>{t`Message preview`}</Label>
					<pre className="whitespace-pre-wrap rounded-lg bg-kumo-tint p-3 text-sm">
						{whatsappPreview(form, t)}
					</pre>
				</div>
			</div>
			<InputArea
				label={t`Payment instructions`}
				value={form.deliveryInstructions ?? ""}
				onChange={(e) => setForm({ ...form, deliveryInstructions: e.target.value || null })}
				rows={4}
				placeholder={t`Share your Yape, Plin, or bank transfer instructions.`}
			/>
			<InputArea
				label={t`Business hours`}
				value={form.businessHours ?? ""}
				onChange={(e) => setForm({ ...form, businessHours: e.target.value || null })}
				rows={3}
			/>
			<div className="rounded-lg border border-kumo-line p-4">
				<Switch
					label={t`Enable service bookings`}
					checked={form.bookingEnabled}
					onCheckedChange={(checked) => setForm({ ...form, bookingEnabled: Boolean(checked) })}
				/>
				<p className="mt-1 text-sm text-kumo-subtle">
					{t`Enable this store to offer services with scheduled bookings.`}
				</p>
			</div>
			<div className="grid gap-4 sm:grid-cols-3">
				<Input
					label={t`Preparation time`}
					value={form.preparationTime ?? ""}
					onChange={(e) => setForm({ ...form, preparationTime: e.target.value || null })}
					placeholder={t`Example: 24 hours`}
				/>
				<Input
					label={t`Minimum order subtotal`}
					type="number"
					min="0"
					value={form.minimumSubtotal}
					onChange={(e) => setForm({ ...form, minimumSubtotal: Number(e.target.value) || 0 })}
				/>
				<div className="space-y-3">
					<Switch
						checked={form.freeDeliveryMinSubtotal !== null}
						onCheckedChange={(enabled) =>
							setForm({
								...form,
								freeDeliveryMinSubtotal: enabled ? (form.freeDeliveryMinSubtotal ?? 0) : null,
							})
						}
						label={t`Enable free delivery`}
					/>
					{form.freeDeliveryMinSubtotal !== null ? (
						<Input
							label={t`Free delivery from subtotal`}
							type="number"
							min="0"
							value={form.freeDeliveryMinSubtotal}
							onChange={(e) =>
								setForm({
									...form,
									freeDeliveryMinSubtotal: Number(e.target.value) || 0,
								})
							}
						/>
					) : null}
				</div>
			</div>
			<div className="space-y-3">
				<Label>{t`Payment methods`}</Label>
				{PAYMENT_METHODS.map((method) => (
					<Switch
						key={method}
						label={paymentMethodLabel(method, t)}
						checked={form.paymentMethods.includes(method)}
						onCheckedChange={(checked) => togglePaymentMethod(method, checked)}
					/>
				))}
			</div>
			<div className="space-y-4 rounded-lg border border-kumo-line p-4">
				<div>
					<h2 className="font-semibold">{t`Payment gateway`}</h2>
					<p className="mt-1 text-sm text-kumo-subtle">{t`Save gateway parameters for a future integration. Orders continue through WhatsApp until a gateway connector is enabled.`}</p>
				</div>
				<Switch
					label={t`Enable payment gateway`}
					checked={Boolean(form.paymentGatewayEnabled)}
					onCheckedChange={(checked) =>
						setForm({ ...form, paymentGatewayEnabled: Boolean(checked) })
					}
				/>
				<div className="grid gap-4 sm:grid-cols-2">
					<Select
						label={t`Provider`}
						value={form.paymentGatewayProvider ?? "custom"}
						onValueChange={(value) =>
							value &&
							setForm({ ...form, paymentGatewayProvider: value === "custom" ? null : value })
						}
						items={{
							custom: t`Select later`,
							mercadopago: "Mercado Pago",
							culqi: "Culqi",
							stripe: "Stripe",
						}}
					/>
					<Select
						label={t`Environment`}
						value={form.paymentGatewayEnvironment}
						onValueChange={(value) =>
							value && setForm({ ...form, paymentGatewayEnvironment: value })
						}
						items={{ sandbox: t`Test mode`, production: t`Production` }}
					/>
				</div>
				<Input
					label={t`Public key`}
					value={form.paymentGatewayPublicKey ?? ""}
					onChange={(event) =>
						setForm({ ...form, paymentGatewayPublicKey: event.target.value || null })
					}
					placeholder={t`Public key from your provider`}
				/>
				<Input
					label={t`Secret key`}
					type="password"
					value={gatewaySecrets.secretKey}
					onChange={(event) =>
						setGatewaySecrets({ ...gatewaySecrets, secretKey: event.target.value })
					}
					placeholder={
						form.paymentGatewaySecretKeyConfigured
							? t`Secret key saved; enter a new one to replace it`
							: t`Secret key from your provider`
					}
				/>
				<Input
					label={t`Webhook secret`}
					type="password"
					value={gatewaySecrets.webhookSecret}
					onChange={(event) =>
						setGatewaySecrets({ ...gatewaySecrets, webhookSecret: event.target.value })
					}
					placeholder={
						form.paymentGatewayWebhookSecretConfigured
							? t`Webhook secret saved; enter a new one to replace it`
							: t`Webhook secret from your provider`
					}
				/>
				<Input
					label={t`Return URL`}
					value={form.paymentGatewayReturnUrl ?? ""}
					onChange={(event) =>
						setForm({ ...form, paymentGatewayReturnUrl: event.target.value || null })
					}
					placeholder="https://example.com/shop/payment-return"
				/>
				<Input
					label={t`Webhook URL`}
					value={form.paymentGatewayWebhookUrl ?? ""}
					onChange={(event) =>
						setForm({ ...form, paymentGatewayWebhookUrl: event.target.value || null })
					}
					placeholder="https://example.com/_emdash/api/shop/payment-webhook"
				/>
			</div>
			<div className="flex justify-end">
				<Button type="submit" disabled={saveMutation.isPending}>
					{saveMutation.isPending ? t`Saving...` : t`Save settings`}
				</Button>
			</div>
		</form>
	);
}

function whatsappPreview(
	settings: ShopSettings,
	t: (descriptor: MessageDescriptor) => string,
): string {
	return [
		settings.whatsappMessage || t(msg`Hello, I want to coordinate payment for my order.`),
		settings.storeName ? `${t(msg`Store`)}: ${settings.storeName}` : null,
		`${t(msg`Order`)}: #ABC12345-TEST`,
		`- ${t(msg`Sample product`)} x1: ${settings.currencySymbol} 35.00`,
		`${t(msg`Total`)}: ${settings.currencySymbol} 35.00`,
	]
		.filter((line): line is string => line !== null)
		.join("\n");
}

function paymentMethodLabel(method: string, t: (descriptor: MessageDescriptor) => string): string {
	const labels: Record<string, MessageDescriptor> = {
		whatsapp: msg`Coordinate by WhatsApp`,
		yape: msg`Yape`,
		plin: msg`Plin`,
		bank_transfer: msg`Bank transfer`,
		cash_on_delivery: msg`Cash on delivery`,
	};
	return labels[method] ? t(labels[method]) : method;
}

function DeliveryZonesPanel() {
	const { t } = useLingui();
	const toastManager = Toast.useToastManager();
	const queryClient = useQueryClient();
	const zonesQuery = useQuery({
		queryKey: ["shop", "delivery-zones"],
		queryFn: fetchShopDeliveryZones,
	});
	const settingsQuery = useQuery({ queryKey: ["shop", "settings"], queryFn: fetchShopSettings });
	const [name, setName] = React.useState("");
	const [districts, setDistricts] = React.useState("");
	const [cost, setCost] = React.useState("0");
	const [estimatedTime, setEstimatedTime] = React.useState("");
	const [editingZone, setEditingZone] = React.useState<ShopDeliveryZone | null>(null);
	const [dialogOpen, setDialogOpen] = React.useState(false);
	const [search, setSearch] = React.useState("");
	const [editForm, setEditForm] = React.useState({
		name: "",
		districts: "",
		deliveryCost: "0",
		estimatedTime: "",
		active: true,
	});

	const createMutation = useMutation({
		mutationFn: () =>
			createShopDeliveryZone({
				name,
				districts: districts
					.split(",")
					.map((item) => item.trim())
					.filter(Boolean),
				deliveryCost: Number(cost),
				estimatedTime: estimatedTime || null,
			}),
		onSuccess: () => {
			setName("");
			setDistricts("");
			setCost("0");
			setEstimatedTime("");
			setDialogOpen(false);
			void queryClient.invalidateQueries({ queryKey: ["shop", "delivery-zones"] });
			toastManager.add({ title: t`Delivery zone created`, type: "success" });
		},
	});
	const updateMutation = useMutation({
		mutationFn: () =>
			updateShopDeliveryZone(editingZone?.id ?? "", {
				name: editForm.name,
				districts: editForm.districts
					.split(",")
					.map((item) => item.trim())
					.filter(Boolean),
				deliveryCost: Number(editForm.deliveryCost),
				estimatedTime: editForm.estimatedTime || null,
				active: editForm.active,
			}),
		onSuccess: () => {
			setEditingZone(null);
			setDialogOpen(false);
			void queryClient.invalidateQueries({ queryKey: ["shop", "delivery-zones"] });
			toastManager.add({ title: t`Delivery zone updated`, type: "success" });
		},
	});
	const deleteMutation = useMutation({
		mutationFn: deleteShopDeliveryZone,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["shop", "delivery-zones"] });
			toastManager.add({ title: t`Delivery zone deleted`, type: "success" });
		},
	});

	if (zonesQuery.isLoading || settingsQuery.isLoading)
		return <LoadingState label={t`Loading delivery zones`} />;
	if (zonesQuery.isError || settingsQuery.isError)
		return <ErrorState label={t`Could not load delivery zones. Please try again.`} />;
	const normalizedSearch = search.trim().toLowerCase();
	const zones = (zonesQuery.data ?? []).filter(
		(zone) =>
			!normalizedSearch ||
			[zone.name, ...zone.districts].some((value) =>
				value.toLowerCase().includes(normalizedSearch),
			),
	);
	const openCreate = () => {
		setEditingZone(null);
		setName("");
		setDistricts("");
		setCost("0");
		setEstimatedTime("");
		setDialogOpen(true);
	};
	const openEdit = (zone: ShopDeliveryZone) => {
		setEditingZone(zone);
		setEditForm({
			name: zone.name,
			districts: zone.districts.join(", "),
			deliveryCost: String(zone.deliveryCost),
			estimatedTime: zone.estimatedTime ?? "",
			active: zone.active,
		});
		setDialogOpen(true);
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-end gap-3">
				<div className="min-w-[240px] flex-1">
					<Input
						label={t`Search delivery zones`}
						placeholder={t`Search by zone or district`}
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
				</div>
				<Button icon={Plus} onClick={openCreate}>{t`New delivery zone`}</Button>
			</div>
			<div className="overflow-x-auto rounded-lg border border-kumo-line">
				<table className="w-full text-start">
					<thead className="border-b border-kumo-line bg-kumo-tint">
						<tr>
							<th className="p-3 text-start text-sm font-medium">{t`Zone`}</th>
							<th className="p-3 text-start text-sm font-medium">{t`Districts`}</th>
							<th className="p-3 text-end text-sm font-medium">{t`Cost`}</th>
							<th className="p-3 text-start text-sm font-medium">{t`Estimated time`}</th>
							<th className="p-3 text-start text-sm font-medium">{t`Status`}</th>
							<th className="p-3 text-end text-sm font-medium">{t`Actions`}</th>
						</tr>
					</thead>
					<tbody>
						{zones.map((zone) => (
							<DeliveryZoneRow
								key={zone.id}
								zone={zone}
								currencySymbol={settingsQuery.data?.currencySymbol ?? "S/"}
								onDelete={() => deleteMutation.mutate(zone.id)}
								onEdit={() => openEdit(zone)}
							/>
						))}
					</tbody>
				</table>
			</div>
			{zones.length === 0 ? (
				<p className="rounded-lg border p-6 text-sm text-kumo-subtle">{t`No delivery zones match your search.`}</p>
			) : null}
			<Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
				<Dialog
					className="max-h-[90vh] w-[min(600px,calc(100vw-2rem))] overflow-y-auto p-6"
					size="lg"
				>
					<div className="mb-4 flex items-center justify-between gap-4">
						<Dialog.Title className="text-lg font-semibold">
							{editingZone ? t`Edit delivery zone` : t`New delivery zone`}
						</Dialog.Title>
						<Dialog.Close
							aria-label={t`Close`}
							render={(props) => (
								<Button {...props} aria-label={t`Close`} variant="ghost" shape="square">
									×
								</Button>
							)}
						/>
					</div>
					<form
						className="space-y-4"
						onSubmit={(event) => {
							event.preventDefault();
							if (editingZone) updateMutation.mutate();
							else createMutation.mutate();
						}}
					>
						<Input
							label={t`Zone name`}
							value={editingZone ? editForm.name : name}
							onChange={(e) =>
								editingZone
									? setEditForm({ ...editForm, name: e.target.value })
									: setName(e.target.value)
							}
							required
						/>
						<Input
							label={t`Districts`}
							value={editingZone ? editForm.districts : districts}
							onChange={(e) =>
								editingZone
									? setEditForm({ ...editForm, districts: e.target.value })
									: setDistricts(e.target.value)
							}
							placeholder={t`District 1, District 2`}
							required
						/>
						<Input
							label={t`Delivery cost`}
							type="number"
							min="0"
							step="0.01"
							value={editingZone ? editForm.deliveryCost : cost}
							onChange={(e) =>
								editingZone
									? setEditForm({ ...editForm, deliveryCost: e.target.value })
									: setCost(e.target.value)
							}
							required
						/>
						<Input
							label={t`Estimated time`}
							value={editingZone ? editForm.estimatedTime : estimatedTime}
							onChange={(e) =>
								editingZone
									? setEditForm({ ...editForm, estimatedTime: e.target.value })
									: setEstimatedTime(e.target.value)
							}
							placeholder={t`Example: 30–60 minutes`}
						/>
						{editingZone ? (
							<Switch
								label={t`Active`}
								checked={editForm.active}
								onCheckedChange={(checked) =>
									setEditForm({ ...editForm, active: Boolean(checked) })
								}
							/>
						) : null}
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setDialogOpen(false)}
							>{t`Cancel`}</Button>
							<Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
								{createMutation.isPending || updateMutation.isPending ? t`Saving...` : t`Save zone`}
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>
		</div>
	);
}

function DeliveryZoneRow({
	zone,
	currencySymbol,
	onDelete,
	onEdit,
}: {
	zone: ShopDeliveryZone;
	currencySymbol: string;
	onDelete: () => void;
	onEdit: () => void;
}) {
	const { t } = useLingui();
	return (
		<tr className="border-b border-kumo-line last:border-0 hover:bg-kumo-tint">
			<td className="p-3 font-medium">{zone.name}</td>
			<td className="max-w-[320px] p-3 text-sm text-kumo-subtle">{zone.districts.join(", ")}</td>
			<td className="p-3 text-end font-medium">{money(zone.deliveryCost, currencySymbol)}</td>
			<td className="p-3 text-sm">{zone.estimatedTime ?? "—"}</td>
			<td className="p-3">
				<Badge variant={zone.active ? "success" : "secondary"}>
					{zone.active ? t`Active` : t`Inactive`}
				</Badge>
			</td>
			<td className="p-3 text-end">
				<div className="flex justify-end gap-2">
					<Button size="sm" variant="outline" onClick={onEdit}>{t`Edit`}</Button>
					<Button
						variant="ghost"
						shape="square"
						aria-label={t`Delete ${zone.name}`}
						onClick={onDelete}
					>
						<Trash className="text-kumo-danger" />
					</Button>
				</div>
			</td>
		</tr>
	);
}

function OrdersPanel() {
	const { t } = useLingui();
	const ordersQuery = useQuery({ queryKey: ["shop", "orders"], queryFn: fetchShopOrders });
	const [selectedId, setSelectedId] = React.useState<string | null>(null);
	const [search, setSearch] = React.useState("");
	const [statusFilter, setStatusFilter] = React.useState("all");
	const detailQuery = useQuery({
		queryKey: ["shop", "order", selectedId],
		queryFn: () => fetchShopOrder(selectedId ?? ""),
		enabled: selectedId !== null,
	});

	if (ordersQuery.isLoading) return <LoadingState label={t`Loading orders`} />;
	const orders = (ordersQuery.data ?? []).filter((order) => {
		const matchesSearch =
			!search.trim() || order.orderNumber.toLowerCase().includes(search.trim().toLowerCase());
		const matchesStatus =
			statusFilter === "all" ||
			order.status === statusFilter ||
			order.paymentStatus === statusFilter ||
			order.deliveryStatus === statusFilter;
		return matchesSearch && matchesStatus;
	});
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<div className="min-w-[240px] flex-1">
					<Input
						label={t`Search orders`}
						placeholder={t`Search by order number`}
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
				</div>
				<div className="min-w-[200px]">
					<Select
						aria-label={t`Filter orders by status`}
						value={statusFilter}
						onValueChange={(value) => value && setStatusFilter(value)}
						items={{
							all: t`All statuses`,
							new: t`New`,
							confirmed: t`Confirmed`,
							preparing: t`Preparing`,
							ready: t`Ready for delivery`,
							in_transit: t`In transit`,
							delivered: t`Delivered`,
							cancelled: t`Cancelled`,
							pending: t`Pending`,
							not_delivered: t`Not delivered`,
							rescheduled: t`Rescheduled`,
						}}
					/>
				</div>
			</div>
			<div className="overflow-x-auto rounded-lg border border-kumo-line">
				<table className="w-full text-start">
					<thead className="border-b border-kumo-line bg-kumo-tint">
						<tr>
							<th className="p-3 text-start text-sm font-medium">{t`Order`}</th>
							<th className="p-3 text-start text-sm font-medium">{t`Status`}</th>
							<th className="p-3 text-start text-sm font-medium">{t`Payment`}</th>
							<th className="p-3 text-start text-sm font-medium">{t`Delivery`}</th>
							<th className="p-3 text-end text-sm font-medium">{t`Total`}</th>
							<th className="p-3 text-end text-sm font-medium">{t`Actions`}</th>
						</tr>
					</thead>
					<tbody>
						{orders.map((order) => (
							<OrderRow key={order.id} order={order} onClick={() => setSelectedId(order.id)} />
						))}
					</tbody>
				</table>
			</div>
			{orders.length === 0 ? (
				<p className="rounded-lg border p-6 text-sm text-kumo-subtle">{t`No orders match your filters.`}</p>
			) : null}
			<Dialog.Root open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
				<Dialog
					className="max-h-[90vh] w-[min(960px,calc(100vw-2rem))] overflow-y-auto p-6"
					size="lg"
				>
					<div className="mb-4 flex items-center justify-between gap-4">
						<Dialog.Title className="text-lg font-semibold">{t`Order details`}</Dialog.Title>
						<Dialog.Close
							aria-label={t`Close`}
							render={(props) => (
								<Button {...props} aria-label={t`Close`} variant="ghost" shape="square">
									×
								</Button>
							)}
						/>
					</div>
					{detailQuery.isLoading ? (
						<LoadingState label={t`Loading order details`} />
					) : detailQuery.data ? (
						<OrderDetailPanel order={detailQuery.data} />
					) : (
						<p className="text-sm text-kumo-subtle">{t`Order details unavailable.`}</p>
					)}
				</Dialog>
			</Dialog.Root>
		</div>
	);
}

function CustomersPanel() {
	const { t } = useLingui();
	const toastManager = Toast.useToastManager();
	const customersQuery = useQuery({ queryKey: ["shop", "customers"], queryFn: fetchShopCustomers });
	const settingsQuery = useQuery({ queryKey: ["shop", "settings"], queryFn: fetchShopSettings });
	const [selectedCustomer, setSelectedCustomer] = React.useState<ShopCustomerSummary | null>(null);
	const [search, setSearch] = React.useState("");
	const [district, setDistrict] = React.useState("all");
	const [period, setPeriod] = React.useState("all");
	const [sort, setSort] = React.useState("recent");

	if (customersQuery.isLoading || settingsQuery.isLoading)
		return <LoadingState label={t`Loading customers`} />;
	if (customersQuery.isError || settingsQuery.isError)
		return <ErrorState label={t`Could not load customers. Please try again.`} />;

	const normalizedSearch = search.trim().toLowerCase();
	const districts = [
		...new Set(
			(customersQuery.data ?? [])
				.map((customer) => customer.district)
				.filter((value): value is string => Boolean(value)),
		),
	].toSorted();
	const periodStart =
		period === "30"
			? Date.now() - 30 * 24 * 60 * 60 * 1000
			: period === "90"
				? Date.now() - 90 * 24 * 60 * 60 * 1000
				: null;
	const customers = (customersQuery.data ?? [])
		.filter((customer) => {
			if (!normalizedSearch) return true;
			return [
				customer.name,
				customer.phone,
				customer.email,
				customer.district,
				customer.lastOrderNumber,
			].some((value) => value?.toLowerCase().includes(normalizedSearch));
		})
		.filter((customer) => district === "all" || customer.district === district)
		.filter(
			(customer) =>
				periodStart === null || new Date(customer.createdAt ?? 0).getTime() >= periodStart,
		)
		.toSorted((a, b) =>
			sort === "orders"
				? b.orderCount - a.orderCount
				: new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
		);

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<div className="min-w-[240px] flex-1">
					<Input
						label={t`Search customers`}
						placeholder={t`Search by name, phone, email, or district`}
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
				</div>
				<div className="min-w-[170px]">
					<Select
						aria-label={t`Filter customers by district`}
						value={district}
						onValueChange={(value) => value && setDistrict(value)}
						items={{
							all: t`All districts`,
							...Object.fromEntries(districts.map((value) => [value, value])),
						}}
					/>
				</div>
				<div className="min-w-[160px]">
					<Select
						aria-label={t`Filter customers by date`}
						value={period}
						onValueChange={(value) => value && setPeriod(value)}
						items={{ all: t`Any date`, "30": t`Last 30 days`, "90": t`Last 90 days` }}
					/>
				</div>
				<div className="min-w-[170px]">
					<Select
						aria-label={t`Sort customers`}
						value={sort}
						onValueChange={(value) => value && setSort(value)}
						items={{ recent: t`Most recent`, orders: t`Most orders` }}
					/>
				</div>
			</div>
			<div className="overflow-x-auto rounded-lg border border-kumo-line">
				<table className="w-full text-start">
					<thead className="border-b border-kumo-line bg-kumo-tint">
						<tr>
							<th className="p-3 text-start text-sm font-medium">{t`Customer`}</th>
							<th className="p-3 text-start text-sm font-medium">{t`Phone`}</th>
							<th className="p-3 text-start text-sm font-medium">{t`District`}</th>
							<th className="p-3 text-end text-sm font-medium">{t`Orders`}</th>
							<th className="p-3 text-end text-sm font-medium">{t`Last order`}</th>
							<th className="p-3 text-end text-sm font-medium">{t`Actions`}</th>
						</tr>
					</thead>
					<tbody>
						{customers.map((customer) => (
							<CustomerRow
								key={customer.id}
								customer={customer}
								onClick={() => setSelectedCustomer(customer)}
							/>
						))}
					</tbody>
				</table>
			</div>
			{customers.length === 0 ? (
				<p className="rounded-lg border p-6 text-sm text-kumo-subtle">{t`No customers match your search.`}</p>
			) : null}
			<Dialog.Root
				open={selectedCustomer !== null}
				onOpenChange={(open) => !open && setSelectedCustomer(null)}
			>
				<Dialog
					className="max-h-[90vh] w-[min(720px,calc(100vw-2rem))] overflow-y-auto p-6"
					size="lg"
				>
					<div className="mb-4 flex items-center justify-between gap-4">
						<Dialog.Title className="text-lg font-semibold">{t`Customer details`}</Dialog.Title>
						<Dialog.Close
							aria-label={t`Close`}
							render={(props) => (
								<Button {...props} aria-label={t`Close`} variant="ghost" shape="square">
									×
								</Button>
							)}
						/>
					</div>
					{selectedCustomer ? (
						<CustomerDetail
							customer={selectedCustomer}
							currencySymbol={settingsQuery.data?.currencySymbol ?? "S/"}
							onCopy={(value) => {
								void navigator.clipboard?.writeText(value);
								toastManager.add({ title: t`Copied to clipboard`, type: "success" });
							}}
						/>
					) : null}
				</Dialog>
			</Dialog.Root>
		</div>
	);
}

function CustomerRow({
	customer,
	onClick,
}: {
	customer: ShopCustomerSummary;
	onClick: () => void;
}) {
	const { t } = useLingui();
	return (
		<tr className="border-b border-kumo-line last:border-0 hover:bg-kumo-tint">
			<td className="p-3 font-medium">{customer.name}</td>
			<td className="p-3">{customer.phone}</td>
			<td className="p-3">{customer.district ?? "—"}</td>
			<td className="p-3 text-end">{customer.orderCount}</td>
			<td className="p-3 text-end">{customer.lastOrderNumber ?? "—"}</td>
			<td className="p-3 text-end">
				<Button size="sm" variant="outline" onClick={onClick}>{t`View details`}</Button>
			</td>
		</tr>
	);
}

function CustomerDetail({
	customer,
	currencySymbol,
	onCopy,
}: {
	customer: ShopCustomerSummary;
	currencySymbol: string;
	onCopy: (value: string) => void;
}) {
	const { t } = useLingui();
	const fields = [
		[t`Name`, customer.name],
		[t`Email`, customer.email],
		[t`Address`, customer.address],
		[t`District`, customer.district],
		[t`Reference`, customer.reference],
		[t`Notes`, customer.notes],
	] as const;
	return (
		<div className="space-y-5">
			<div className="flex flex-wrap gap-2">
				<Button
					size="sm"
					onClick={() =>
						window.open(
							`https://wa.me/${customer.phone.replace(/\D/g, "")}`,
							"_blank",
							"noopener,noreferrer",
						)
					}
				>{t`Open WhatsApp`}</Button>
				<Button
					size="sm"
					variant="outline"
					onClick={() => onCopy(customer.phone)}
				>{t`Copy phone`}</Button>
				{customer.address ? (
					<Button
						size="sm"
						variant="outline"
						onClick={() => onCopy(customer.address ?? "")}
					>{t`Copy address`}</Button>
				) : null}
			</div>
			<div className="rounded-lg border border-kumo-line p-4">
				<div className="flex flex-wrap justify-between gap-3">
					<div>
						<p className="text-sm text-kumo-subtle">{t`Orders`}</p>
						<p className="text-xl font-semibold">{customer.orderCount}</p>
					</div>
					<div className="text-end">
						<p className="text-sm text-kumo-subtle">{t`Total spent`}</p>
						<p className="text-xl font-semibold">{money(customer.totalSpent, currencySymbol)}</p>
					</div>
				</div>
			</div>
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="rounded-lg border border-kumo-line p-3">
					<p className="text-sm text-kumo-subtle">{t`Phone`}</p>
					<p className="mt-1">{customer.phone}</p>
				</div>
				{fields.map(([label, value]) => (
					<div key={label} className="rounded-lg border border-kumo-line p-3">
						<p className="text-sm text-kumo-subtle">{label}</p>
						<p className="mt-1 whitespace-pre-wrap">{value || "—"}</p>
					</div>
				))}
			</div>
			<div>
				<h3 className="mb-2 font-medium">{t`Order history`}</h3>
				{customer.orders.length === 0 ? (
					<p className="text-sm text-kumo-subtle">{t`No orders yet.`}</p>
				) : (
					<div className="space-y-2">
						{customer.orders.map((order) => (
							<div
								key={order.orderNumber}
								className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-kumo-line p-3 text-sm"
							>
								<span className="font-medium">{order.orderNumber}</span>
								<Badge>{formatStatus(order.status, t)}</Badge>
								<span>{money(order.total, currencySymbol)}</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function OrderRow({ order, onClick }: { order: ShopOrderSummary; onClick: () => void }) {
	const { t } = useLingui();
	return (
		<tr className="border-b border-kumo-line last:border-0 hover:bg-kumo-tint">
			<td className="p-3 font-medium">{order.orderNumber}</td>
			<td className="p-3">
				<Badge>{formatStatus(order.status, t)}</Badge>
			</td>
			<td className="p-3">
				<Badge variant={order.paymentStatus === "confirmed" ? "success" : "secondary"}>
					{formatStatus(order.paymentStatus, t)}
				</Badge>
			</td>
			<td className="p-3">
				<Badge variant="secondary">{formatStatus(order.deliveryStatus, t)}</Badge>
			</td>
			<td className="p-3 text-end font-medium">{money(order.total, order.currencySymbol)}</td>
			<td className="p-3 text-end">
				<Button size="sm" variant="outline" onClick={onClick}>{t`View details`}</Button>
			</td>
		</tr>
	);
}

function OrderDetailPanel({ order }: { order: ShopOrderDetail }) {
	const { t } = useLingui();
	const toastManager = Toast.useToastManager();
	const queryClient = useQueryClient();
	const paymentMutation = useMutation({
		mutationFn: () => confirmShopPayment(order.id),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["shop", "orders"] });
			void queryClient.invalidateQueries({ queryKey: ["shop", "order", order.id] });
			toastManager.add({ title: t`Payment confirmed`, type: "success" });
		},
	});
	const deliveryMutation = useMutation({
		mutationFn: ({ status, cancellationReason }: { status: string; cancellationReason?: string }) =>
			updateShopDelivery(order.id, {
				status,
				trackingCode: trackingCode || null,
				trackingUrl: trackingUrl || null,
				cancellationReason: cancellationReason || null,
			}),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["shop", "orders"] });
			void queryClient.invalidateQueries({ queryKey: ["shop", "order", order.id] });
			toastManager.add({ title: t`Delivery updated`, type: "success" });
		},
	});
	const [trackingCode, setTrackingCode] = React.useState(
		typeof order.delivery.trackingCode === "string" ? order.delivery.trackingCode : "",
	);
	const [trackingUrl, setTrackingUrl] = React.useState(
		typeof order.delivery.trackingUrl === "string" ? order.delivery.trackingUrl : "",
	);
	const [pendingStatus, setPendingStatus] = React.useState<string | null>(null);
	const [cancellationReason, setCancellationReason] = React.useState("");
	const [templateKey, setTemplateKey] = React.useState(
		order.deliveryStatus === "delivered"
			? "delivered"
			: order.deliveryStatus === "in_transit"
				? "inTransit"
				: order.status === "preparing"
					? "preparing"
					: "orderReceived",
	);
	const whatsappWindowRef = React.useRef<Window | null>(null);
	const whatsappMutation = useMutation({
		mutationFn: () => fetchShopOrderWhatsAppUrl(order.id, templateKey),
		onSuccess: (url) => {
			if (!url.startsWith("https://wa.me/")) {
				whatsappWindowRef.current?.close();
				whatsappWindowRef.current = null;
				return;
			}
			if (whatsappWindowRef.current) {
				whatsappWindowRef.current.location.href = url;
				whatsappWindowRef.current = null;
			} else {
				window.open(url, "_blank", "noopener,noreferrer");
			}
		},
	});
	const customerName = typeof order.customer.name === "string" ? order.customer.name : t`Customer`;
	const address = typeof order.delivery.address === "string" ? order.delivery.address : "";
	return (
		<div className="space-y-5 rounded-xl border border-kumo-line bg-kumo-base p-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<p className="text-sm text-kumo-subtle">{t`Order`}</p>
					<h2 className="text-xl font-semibold">{order.orderNumber}</h2>
				</div>
				<div className="text-end">
					<p className="text-sm text-kumo-subtle">{t`Total`}</p>
					<span className="text-xl font-semibold">{money(order.total, order.currencySymbol)}</span>
				</div>
			</div>
			<div className="rounded-lg bg-kumo-tint p-4">
				<p className="font-medium">{customerName}</p>
				<p className="text-sm text-kumo-subtle">{address}</p>
			</div>
			<div className="space-y-2 rounded-lg border border-kumo-line p-4">
				<p className="text-sm font-medium">{t`Products`}</p>
				{order.items.map((item) => (
					<div key={item.id} className="flex justify-between gap-3 text-sm">
						<span>
							{item.productName} × {item.quantity}
						</span>
						<span>{money(item.subtotal, order.currencySymbol)}</span>
					</div>
				))}
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="rounded-lg border border-kumo-line p-3">
					<p className="mb-2 text-sm text-kumo-subtle">{t`Payment status`}</p>
					<Badge variant={order.paymentStatus === "confirmed" ? "success" : "secondary"}>
						{formatStatus(order.paymentStatus, t)}
					</Badge>
					{order.paymentStatus !== "confirmed" ? (
						<div className="mt-3 space-y-2">
							<p className="text-xs text-kumo-subtle">{t`Press once to confirm the payment.`}</p>
							<Button
								size="sm"
								icon={<CheckCircle />}
								onClick={() => paymentMutation.mutate()}
								disabled={paymentMutation.isPending}
							>
								{paymentMutation.isPending ? t`Confirming...` : t`Confirm payment`}
							</Button>
						</div>
					) : null}
				</div>
				<div className="rounded-lg border border-kumo-line p-3">
					<p className="mb-2 text-sm text-kumo-subtle">{t`Delivery status`}</p>
					<Badge variant={order.deliveryStatus === "delivered" ? "success" : "secondary"}>
						{formatStatus(order.deliveryStatus, t)}
					</Badge>
					<div className="mt-3">
						<Select
							aria-label={t`Update delivery status`}
							value={order.deliveryStatus}
							onValueChange={(value) => {
								if (value === "cancelled") {
									setPendingStatus(value);
									return;
								}
								if (value) deliveryMutation.mutate({ status: value });
							}}
							items={{
								pending: t`Pending`,
								assigned: t`Assigned`,
								preparing: t`Preparing`,
								in_transit: t`In transit`,
								delivered: t`Delivered`,
								not_delivered: t`Not delivered`,
								rescheduled: t`Rescheduled`,
								cancelled: t`Cancelled`,
							}}
						/>
					</div>
				</div>
			</div>
			{pendingStatus === "cancelled" ? (
				<div className="space-y-2 rounded-lg border border-kumo-line p-3">
					<InputArea
						label={t`Cancellation reason`}
						value={cancellationReason}
						onChange={(event) => setCancellationReason(event.target.value)}
						placeholder={t`Explain why this order is being cancelled`}
						rows={3}
						required
					/>
					<div className="flex justify-end gap-2">
						<Button type="button" variant="ghost" onClick={() => setPendingStatus(null)}>
							{t`Cancel`}
						</Button>
						<Button
							type="button"
							disabled={!cancellationReason.trim() || deliveryMutation.isPending}
							onClick={() => {
								deliveryMutation.mutate({
									status: "cancelled",
									cancellationReason: cancellationReason.trim(),
								});
								setPendingStatus(null);
							}}
						>
							{t`Confirm cancellation`}
						</Button>
					</div>
				</div>
			) : null}
			<div className="grid gap-4 sm:grid-cols-2">
				<Input
					label={t`Tracking code (optional)`}
					value={trackingCode}
					onChange={(event) => setTrackingCode(event.target.value)}
					placeholder={t`Code from delivery provider`}
				/>
				<Input
					label={t`Tracking URL (optional)`}
					type="url"
					value={trackingUrl}
					onChange={(event) => setTrackingUrl(event.target.value)}
					placeholder="https://delivery.example/track/..."
				/>
			</div>
			<div className="space-y-3 rounded-lg border border-kumo-line p-4">
				<div>
					<p className="font-medium">{t`WhatsApp message`}</p>
					<p className="text-sm text-kumo-subtle">{t`Choose a template, review it in WhatsApp, and send it manually.`}</p>
				</div>
				<div className="flex flex-wrap items-end gap-3">
					<div className="min-w-[240px] flex-1">
						<Select
							label={t`Message template`}
							value={templateKey}
							onValueChange={(value) => value && setTemplateKey(value)}
							items={{
								orderReceived: t`Order received`,
								paymentConfirmed: t`Payment confirmed`,
								preparing: t`Preparing`,
								inTransit: t`In transit`,
								delivered: t`Delivered`,
								cancelled: t`Cancelled`,
							}}
						/>
					</div>
					<Button
						type="button"
						disabled={whatsappMutation.isPending}
						onClick={() => {
							const whatsappWindow = window.open("about:blank", "_blank");
							if (whatsappWindow) whatsappWindow.opener = null;
							whatsappWindowRef.current = whatsappWindow;
							whatsappMutation.mutate();
						}}
					>
						{whatsappMutation.isPending ? t`Opening...` : t`Open WhatsApp`}
					</Button>
				</div>
			</div>
		</div>
	);
}

function LoadingState({ label }: { label: string }) {
	return (
		<div className="flex items-center gap-2 text-sm text-kumo-subtle">
			<Loader />
			<span>{label}</span>
		</div>
	);
}

function ErrorState({ label }: { label: string }) {
	return (
		<p className="rounded-lg border border-kumo-danger p-6 text-sm text-kumo-danger">{label}</p>
	);
}
