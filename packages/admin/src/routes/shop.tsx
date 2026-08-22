import { Badge, Button, Dialog, Input, InputArea, Label, Loader, Select, Switch, Toast } from "@cloudflare/kumo";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import { useLingui } from "@lingui/react/macro";
import { CheckCircle, Plus, Trash } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import {
	confirmShopPayment,
	createShopDeliveryZone,
	deleteShopDeliveryZone,
	fetchShopDeliveryZones,
	updateShopDeliveryZone,
	fetchShopCustomers,
	fetchShopOrder,
	fetchShopOrders,
	fetchShopSettings,
	type ShopSettingsUpdateInput,
	type ShopDeliveryZone,
	type ShopCustomerSummary,
	type ShopOrderDetail,
	type ShopOrderSummary,
	type ShopSettings,
	updateShopDelivery,
	updateShopSettings,
} from "../lib/api/index.js";

type ShopTab = "settings" | "delivery" | "orders" | "customers";

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
		pending: msg`Pending`,
	};
	const label = labels[status];
	return label ? t(label) : status;
}

function money(value: number, symbol: string): string {
	return `${symbol} ${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
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
				{([
					["settings", t`Store settings`],
					["delivery", t`Delivery zones`],
					["orders", t`Orders`],
					["customers", t`Customers`],
				] as const).map(([value, label]) => (
					<Button key={value} variant={tab === value ? "secondary" : "ghost"} onClick={() => setTab(value)}>
						{label}
					</Button>
				))}
			</div>
			{tab === "settings" ? <ShopSettingsPanel /> : null}
			{tab === "delivery" ? <DeliveryZonesPanel /> : null}
			{tab === "orders" ? <OrdersPanel /> : null}
			{tab === "customers" ? <CustomersPanel /> : null}
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
			className="max-w-2xl space-y-6"
			 onSubmit={(event) => {
				event.preventDefault();
				saveMutation.mutate({
					...form,
					paymentGatewaySecretKey: gatewaySecrets.secretKey || undefined,
					paymentGatewayWebhookSecret: gatewaySecrets.webhookSecret || undefined,
				});
			}}
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<Input label={t`Store name`} value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} required />
				<div className="grid gap-4 sm:grid-cols-2"><Input label={t`Currency`} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={3} required /><Input label={t`Currency symbol`} value={form.currencySymbol} onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })} maxLength={8} placeholder={t`Example: S/`} required /></div>
			</div>
			<div className="space-y-2">
				<Label>{t`WhatsApp number`}</Label>
				<Input value={form.whatsappNumber ?? ""} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value || null })} placeholder={t`Example: 51999999999`} />
				<p className="text-sm text-kumo-subtle">{t`Use the country code without spaces or symbols.`}</p>
			</div>
			<div className="space-y-4 rounded-lg border border-kumo-line p-4">
				<div>
					<h2 className="font-semibold">{t`WhatsApp order message`}</h2>
					<p className="mt-1 text-sm text-kumo-subtle">{t`The store name, order number, products, and total are added automatically.`}</p>
				</div>
				<InputArea label={t`Message introduction`} value={form.whatsappMessage ?? ""} onChange={(e) => setForm({ ...form, whatsappMessage: e.target.value || null })} rows={4} placeholder={t`Hello, I want to coordinate payment for my order.`} />
				<div className="space-y-2">
					<Label>{t`Message preview`}</Label>
					<pre className="whitespace-pre-wrap rounded-lg bg-kumo-tint p-3 text-sm">{whatsappPreview(form, t)}</pre>
				</div>
			</div>
			<InputArea label={t`Payment instructions`} value={form.deliveryInstructions ?? ""} onChange={(e) => setForm({ ...form, deliveryInstructions: e.target.value || null })} rows={4} placeholder={t`Share your Yape, Plin, or bank transfer instructions.`} />
			<InputArea label={t`Business hours`} value={form.businessHours ?? ""} onChange={(e) => setForm({ ...form, businessHours: e.target.value || null })} rows={3} />
			<div className="space-y-3">
				<Label>{t`Payment methods`}</Label>
				{PAYMENT_METHODS.map((method) => (
					<Switch key={method} label={paymentMethodLabel(method, t)} checked={form.paymentMethods.includes(method)} onCheckedChange={(checked) => togglePaymentMethod(method, checked)} />
				))}
			</div>
			<div className="space-y-4 rounded-lg border border-kumo-line p-4">
				<div>
					<h2 className="font-semibold">{t`Payment gateway`}</h2>
					<p className="mt-1 text-sm text-kumo-subtle">{t`Save gateway parameters for a future integration. Orders continue through WhatsApp until a gateway connector is enabled.`}</p>
				</div>
				<Switch label={t`Enable payment gateway`} checked={Boolean(form.paymentGatewayEnabled)} onCheckedChange={(checked) => setForm({ ...form, paymentGatewayEnabled: Boolean(checked) })} />
				<div className="grid gap-4 sm:grid-cols-2">
					<Select label={t`Provider`} value={form.paymentGatewayProvider ?? "custom"} onValueChange={(value) => value && setForm({ ...form, paymentGatewayProvider: value === "custom" ? null : value })} items={{ custom: t`Select later`, mercadopago: "Mercado Pago", culqi: "Culqi", stripe: "Stripe" }} />
					<Select label={t`Environment`} value={form.paymentGatewayEnvironment} onValueChange={(value) => value && setForm({ ...form, paymentGatewayEnvironment: value as "sandbox" | "production" })} items={{ sandbox: t`Test mode`, production: t`Production` }} />
				</div>
				<Input label={t`Public key`} value={form.paymentGatewayPublicKey ?? ""} onChange={(event) => setForm({ ...form, paymentGatewayPublicKey: event.target.value || null })} placeholder={t`Public key from your provider`} />
				<Input label={t`Secret key`} type="password" value={gatewaySecrets.secretKey} onChange={(event) => setGatewaySecrets({ ...gatewaySecrets, secretKey: event.target.value })} placeholder={form.paymentGatewaySecretKeyConfigured ? t`Secret key saved; enter a new one to replace it` : t`Secret key from your provider`} />
				<Input label={t`Webhook secret`} type="password" value={gatewaySecrets.webhookSecret} onChange={(event) => setGatewaySecrets({ ...gatewaySecrets, webhookSecret: event.target.value })} placeholder={form.paymentGatewayWebhookSecretConfigured ? t`Webhook secret saved; enter a new one to replace it` : t`Webhook secret from your provider`} />
				<Input label={t`Return URL`} value={form.paymentGatewayReturnUrl ?? ""} onChange={(event) => setForm({ ...form, paymentGatewayReturnUrl: event.target.value || null })} placeholder="https://example.com/shop/payment-return" />
				<Input label={t`Webhook URL`} value={form.paymentGatewayWebhookUrl ?? ""} onChange={(event) => setForm({ ...form, paymentGatewayWebhookUrl: event.target.value || null })} placeholder="https://example.com/_emdash/api/shop/payment-webhook" />
			</div>
			<div className="flex justify-end">
				<Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? t`Saving...` : t`Save settings`}</Button>
			</div>
		</form>
	);
}

function whatsappPreview(settings: ShopSettings, t: (descriptor: MessageDescriptor) => string): string {
	return [
		settings.whatsappMessage || t(msg`Hello, I want to coordinate payment for my order.`),
		settings.storeName ? `${t(msg`Store`)}: ${settings.storeName}` : null,
		`${t(msg`Order`)}: #ABC12345-TEST`,
		`- ${t(msg`Sample product`)} x1: ${settings.currencySymbol} 35.00`,
		`${t(msg`Total`)}: ${settings.currencySymbol} 35.00`,
	].filter((line): line is string => line !== null).join("\n");
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
	const zonesQuery = useQuery({ queryKey: ["shop", "delivery-zones"], queryFn: fetchShopDeliveryZones });
	const settingsQuery = useQuery({ queryKey: ["shop", "settings"], queryFn: fetchShopSettings });
	const [name, setName] = React.useState("");
	const [districts, setDistricts] = React.useState("");
	const [cost, setCost] = React.useState("0");
	const [estimatedTime, setEstimatedTime] = React.useState("");
	const [editingZone, setEditingZone] = React.useState<ShopDeliveryZone | null>(null);
	const [editForm, setEditForm] = React.useState({ name: "", districts: "", deliveryCost: "0", estimatedTime: "", active: true });

	const createMutation = useMutation({
		mutationFn: () => createShopDeliveryZone({ name, districts: districts.split(",").map((item) => item.trim()).filter(Boolean), deliveryCost: Number(cost), estimatedTime: estimatedTime || null }),
			onSuccess: () => {
			setName("");
			setDistricts("");
			setCost("0");
			setEstimatedTime("");
			void queryClient.invalidateQueries({ queryKey: ["shop", "delivery-zones"] });
			toastManager.add({ title: t`Delivery zone created`, type: "success" });
		},
	});
	const updateMutation = useMutation({
		mutationFn: () => updateShopDeliveryZone(editingZone?.id ?? "", { name: editForm.name, districts: editForm.districts.split(",").map((item) => item.trim()).filter(Boolean), deliveryCost: Number(editForm.deliveryCost), estimatedTime: editForm.estimatedTime || null, active: editForm.active }),
		onSuccess: () => {
			setEditingZone(null);
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

	if (zonesQuery.isLoading || settingsQuery.isLoading) return <LoadingState label={t`Loading delivery zones`} />;

	return (
		<div className="space-y-6">
			<div className="overflow-x-auto rounded-lg border border-kumo-line">
				<table className="w-full text-start">
					<thead className="border-b border-kumo-line bg-kumo-tint"><tr><th className="p-3 text-start text-sm font-medium">{t`Zone`}</th><th className="p-3 text-start text-sm font-medium">{t`Districts`}</th><th className="p-3 text-end text-sm font-medium">{t`Cost`}</th><th className="p-3 text-start text-sm font-medium">{t`Estimated time`}</th><th className="p-3 text-start text-sm font-medium">{t`Status`}</th><th className="p-3 text-end text-sm font-medium">{t`Actions`}</th></tr></thead>
					<tbody>{(zonesQuery.data ?? []).map((zone) => <DeliveryZoneRow key={zone.id} zone={zone} currencySymbol={settingsQuery.data?.currencySymbol ?? "S/"} onDelete={() => deleteMutation.mutate(zone.id)} onEdit={() => { setEditingZone(zone); setEditForm({ name: zone.name, districts: zone.districts.join(", "), deliveryCost: String(zone.deliveryCost), estimatedTime: zone.estimatedTime ?? "", active: zone.active }); }} />)}</tbody>
				</table>
			</div>
			{(zonesQuery.data ?? []).length === 0 ? <p className="rounded-lg border p-6 text-sm text-kumo-subtle">{t`No delivery zones configured yet.`}</p> : null}
			<form className="space-y-4 rounded-lg border p-4" onSubmit={(event) => { event.preventDefault(); createMutation.mutate(); }}>
				<h2 className="text-lg font-semibold">{t`Add delivery zone`}</h2>
				<Input label={t`Zone name`} value={name} onChange={(e) => setName(e.target.value)} required />
				<Input label={t`Districts`} value={districts} onChange={(e) => setDistricts(e.target.value)} placeholder={t`District 1, District 2`} required />
				<Input label={t`Delivery cost`} type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} required />
				<Input label={t`Estimated time`} value={estimatedTime} onChange={(e) => setEstimatedTime(e.target.value)} placeholder={t`Example: 30–60 minutes`} />
				<Button type="submit" icon={<Plus />} disabled={createMutation.isPending}>{t`Add zone`}</Button>
			</form>
			<Dialog.Root open={editingZone !== null} onOpenChange={(open) => !open && setEditingZone(null)}>
				<Dialog className="w-[min(600px,calc(100vw-2rem))] p-6">
					<div className="mb-4 flex items-center justify-between gap-4"><Dialog.Title className="text-lg font-semibold">{t`Edit delivery zone`}</Dialog.Title><Dialog.Close aria-label={t`Close`} render={(props) => <Button {...props} aria-label={t`Close`} variant="ghost" shape="square">×</Button>} /></div>
					<form className="space-y-4" onSubmit={(event) => { event.preventDefault(); updateMutation.mutate(); }}>
						<Input label={t`Zone name`} value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} required />
						<Input label={t`Districts`} value={editForm.districts} onChange={(event) => setEditForm({ ...editForm, districts: event.target.value })} required />
						<div className="grid gap-4 sm:grid-cols-2"><Input label={t`Delivery cost`} type="number" min="0" step="0.01" value={editForm.deliveryCost} onChange={(event) => setEditForm({ ...editForm, deliveryCost: event.target.value })} required /><Input label={t`Estimated time`} value={editForm.estimatedTime} onChange={(event) => setEditForm({ ...editForm, estimatedTime: event.target.value })} /></div>
						<Switch label={t`Active`} checked={editForm.active} onCheckedChange={(checked) => setEditForm({ ...editForm, active: Boolean(checked) })} />
						<div className="flex justify-end"><Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? t`Saving...` : t`Save changes`}</Button></div>
					</form>
				</Dialog>
			</Dialog.Root>
		</div>
	);
}

function DeliveryZoneRow({ zone, currencySymbol, onDelete, onEdit }: { zone: ShopDeliveryZone; currencySymbol: string; onDelete: () => void; onEdit: () => void }) {
	const { t } = useLingui();
	return <tr className="border-b border-kumo-line last:border-0 hover:bg-kumo-tint"><td className="p-3 font-medium">{zone.name}</td><td className="max-w-[320px] p-3 text-sm text-kumo-subtle">{zone.districts.join(", ")}</td><td className="p-3 text-end font-medium">{money(zone.deliveryCost, currencySymbol)}</td><td className="p-3 text-sm">{zone.estimatedTime ?? "—"}</td><td className="p-3"><Badge variant={zone.active ? "success" : "secondary"}>{zone.active ? t`Active` : t`Inactive`}</Badge></td><td className="p-3 text-end"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={onEdit}>{t`Edit`}</Button><Button variant="ghost" shape="square" aria-label={t`Delete ${zone.name}`} onClick={onDelete}><Trash className="text-kumo-danger" /></Button></div></td></tr>;
}

function OrdersPanel() {
	const { t } = useLingui();
	const ordersQuery = useQuery({ queryKey: ["shop", "orders"], queryFn: fetchShopOrders });
	const [selectedId, setSelectedId] = React.useState<string | null>(null);
	const [search, setSearch] = React.useState("");
	const [statusFilter, setStatusFilter] = React.useState("all");
	const detailQuery = useQuery({ queryKey: ["shop", "order", selectedId], queryFn: () => fetchShopOrder(selectedId ?? ""), enabled: selectedId !== null });

	if (ordersQuery.isLoading) return <LoadingState label={t`Loading orders`} />;
	const orders = (ordersQuery.data ?? []).filter((order) => {
		const matchesSearch = !search.trim() || order.orderNumber.toLowerCase().includes(search.trim().toLowerCase());
		const matchesStatus = statusFilter === "all" || order.status === statusFilter || order.paymentStatus === statusFilter || order.deliveryStatus === statusFilter;
		return matchesSearch && matchesStatus;
	});
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<div className="min-w-[240px] flex-1"><Input label={t`Search orders`} placeholder={t`Search by order number`} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
				<div className="min-w-[200px]"><Select aria-label={t`Filter orders by status`} value={statusFilter} onValueChange={(value) => value && setStatusFilter(value)} items={{ all: t`All statuses`, new: t`New`, confirmed: t`Confirmed`, preparing: t`Preparing`, ready: t`Ready for delivery`, in_transit: t`In transit`, delivered: t`Delivered`, cancelled: t`Cancelled`, pending: t`Pending` }} /></div>
			</div>
			<div className="overflow-x-auto rounded-lg border border-kumo-line">
				<table className="w-full text-start">
					<thead className="border-b border-kumo-line bg-kumo-tint"><tr><th className="p-3 text-start text-sm font-medium">{t`Order`}</th><th className="p-3 text-start text-sm font-medium">{t`Status`}</th><th className="p-3 text-start text-sm font-medium">{t`Payment`}</th><th className="p-3 text-start text-sm font-medium">{t`Delivery`}</th><th className="p-3 text-end text-sm font-medium">{t`Total`}</th><th className="p-3 text-end text-sm font-medium">{t`Actions`}</th></tr></thead>
					<tbody>
						{orders.map((order) => <OrderRow key={order.id} order={order} onClick={() => setSelectedId(order.id)} />)}
					</tbody>
				</table>
			</div>
			{orders.length === 0 ? <p className="rounded-lg border p-6 text-sm text-kumo-subtle">{t`No orders match your filters.`}</p> : null}
			<Dialog.Root open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
				<Dialog className="max-h-[90vh] w-[min(960px,calc(100vw-2rem))] overflow-y-auto p-6" size="lg">
					<div className="mb-4 flex items-center justify-between gap-4">
						<Dialog.Title className="text-lg font-semibold">{t`Order details`}</Dialog.Title>
						<Dialog.Close aria-label={t`Close`} render={(props) => <Button {...props} aria-label={t`Close`} variant="ghost" shape="square">×</Button>} />
					</div>
					{detailQuery.isLoading ? <LoadingState label={t`Loading order details`} /> : detailQuery.data ? <OrderDetailPanel order={detailQuery.data} /> : <p className="text-sm text-kumo-subtle">{t`Order details unavailable.`}</p>}
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

	if (customersQuery.isLoading || settingsQuery.isLoading) return <LoadingState label={t`Loading customers`} />;
	if (customersQuery.isError || settingsQuery.isError) return <ErrorState label={t`Could not load customers. Please try again.`} />;

	const normalizedSearch = search.trim().toLowerCase();
	const districts = [...new Set((customersQuery.data ?? []).map((customer) => customer.district).filter((value): value is string => Boolean(value)))].toSorted();
	const periodStart = period === "30" ? Date.now() - 30 * 24 * 60 * 60 * 1000 : period === "90" ? Date.now() - 90 * 24 * 60 * 60 * 1000 : null;
	const customers = (customersQuery.data ?? []).filter((customer) => {
		if (!normalizedSearch) return true;
		return [customer.name, customer.phone, customer.email, customer.district, customer.lastOrderNumber]
			.some((value) => value?.toLowerCase().includes(normalizedSearch));
	}).filter((customer) => district === "all" || customer.district === district)
		.filter((customer) => periodStart === null || new Date(customer.createdAt ?? 0).getTime() >= periodStart)
		.toSorted((a, b) => sort === "orders" ? b.orderCount - a.orderCount : new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<div className="min-w-[240px] flex-1">
					<Input label={t`Search customers`} placeholder={t`Search by name, phone, email, or district`} value={search} onChange={(event) => setSearch(event.target.value)} />
				</div>
				<div className="min-w-[170px]"><Select aria-label={t`Filter customers by district`} value={district} onValueChange={(value) => value && setDistrict(value)} items={{ all: t`All districts`, ...Object.fromEntries(districts.map((value) => [value, value])) }} /></div>
				<div className="min-w-[160px]"><Select aria-label={t`Filter customers by date`} value={period} onValueChange={(value) => value && setPeriod(value)} items={{ all: t`Any date`, "30": t`Last 30 days`, "90": t`Last 90 days` }} /></div>
				<div className="min-w-[170px]"><Select aria-label={t`Sort customers`} value={sort} onValueChange={(value) => value && setSort(value)} items={{ recent: t`Most recent`, orders: t`Most orders` }} /></div>
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
						{customers.map((customer) => <CustomerRow key={customer.id} customer={customer} onClick={() => setSelectedCustomer(customer)} />)}
					</tbody>
				</table>
			</div>
			{customers.length === 0 ? <p className="rounded-lg border p-6 text-sm text-kumo-subtle">{t`No customers match your search.`}</p> : null}
			<Dialog.Root open={selectedCustomer !== null} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
				<Dialog className="max-h-[90vh] w-[min(720px,calc(100vw-2rem))] overflow-y-auto p-6" size="lg">
					<div className="mb-4 flex items-center justify-between gap-4">
						<Dialog.Title className="text-lg font-semibold">{t`Customer details`}</Dialog.Title>
						<Dialog.Close aria-label={t`Close`} render={(props) => <Button {...props} aria-label={t`Close`} variant="ghost" shape="square">×</Button>} />
					</div>
					{selectedCustomer ? <CustomerDetail customer={selectedCustomer} currencySymbol={settingsQuery.data?.currencySymbol ?? "S/"} onCopy={(value) => { void navigator.clipboard?.writeText(value); toastManager.add({ title: t`Copied to clipboard`, type: "success" }); }} /> : null}
				</Dialog>
			</Dialog.Root>
		</div>
	);
}

function CustomerRow({ customer, onClick }: { customer: ShopCustomerSummary; onClick: () => void }) {
	const { t } = useLingui();
	return <tr className="border-b border-kumo-line last:border-0 hover:bg-kumo-tint">
		<td className="p-3 font-medium">{customer.name}</td>
		<td className="p-3">{customer.phone}</td>
		<td className="p-3">{customer.district ?? "—"}</td>
		<td className="p-3 text-end">{customer.orderCount}</td>
		<td className="p-3 text-end">{customer.lastOrderNumber ?? "—"}</td>
		<td className="p-3 text-end"><Button size="sm" variant="outline" onClick={onClick}>{t`View details`}</Button></td>
	</tr>;
}

function CustomerDetail({ customer, currencySymbol, onCopy }: { customer: ShopCustomerSummary; currencySymbol: string; onCopy: (value: string) => void }) {
	const { t } = useLingui();
	const fields = [
		[t`Name`, customer.name],
		[t`Email`, customer.email],
		[t`Address`, customer.address],
		[t`District`, customer.district],
		[t`Reference`, customer.reference],
		[t`Notes`, customer.notes],
	] as const;
	return <div className="space-y-5">
		<div className="flex flex-wrap gap-2">
			<Button size="sm" onClick={() => window.open(`https://wa.me/${customer.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer")}>{t`Open WhatsApp`}</Button>
			<Button size="sm" variant="outline" onClick={() => onCopy(customer.phone)}>{t`Copy phone`}</Button>
			{customer.address ? <Button size="sm" variant="outline" onClick={() => onCopy(customer.address ?? "")}>{t`Copy address`}</Button> : null}
		</div>
		<div className="rounded-lg border border-kumo-line p-4">
			<div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm text-kumo-subtle">{t`Orders`}</p><p className="text-xl font-semibold">{customer.orderCount}</p></div><div className="text-end"><p className="text-sm text-kumo-subtle">{t`Total spent`}</p><p className="text-xl font-semibold">{money(customer.totalSpent, currencySymbol)}</p></div></div>
		</div>
		<div className="grid gap-4 sm:grid-cols-2">
			<div className="rounded-lg border border-kumo-line p-3"><p className="text-sm text-kumo-subtle">{t`Phone`}</p><p className="mt-1">{customer.phone}</p></div>
		{fields.map(([label, value]) => <div key={label} className="rounded-lg border border-kumo-line p-3">
			<p className="text-sm text-kumo-subtle">{label}</p>
			<p className="mt-1 whitespace-pre-wrap">{value || "—"}</p>
		</div>)}
		</div>
		<div><h3 className="mb-2 font-medium">{t`Order history`}</h3>{customer.orders.length === 0 ? <p className="text-sm text-kumo-subtle">{t`No orders yet.`}</p> : <div className="space-y-2">{customer.orders.map((order) => <div key={order.orderNumber} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-kumo-line p-3 text-sm"><span className="font-medium">{order.orderNumber}</span><Badge>{formatStatus(order.status, t)}</Badge><span>{money(order.total, currencySymbol)}</span></div>)}</div>}</div>
	</div>;
}

function OrderRow({ order, onClick }: { order: ShopOrderSummary; onClick: () => void }) {
	const { t } = useLingui();
	return <tr className="border-b border-kumo-line last:border-0 hover:bg-kumo-tint">
		<td className="p-3 font-medium">{order.orderNumber}</td>
		<td className="p-3"><Badge>{formatStatus(order.status, t)}</Badge></td>
		<td className="p-3"><Badge variant={order.paymentStatus === "confirmed" ? "success" : "secondary"}>{formatStatus(order.paymentStatus, t)}</Badge></td>
		<td className="p-3"><Badge variant="secondary">{formatStatus(order.deliveryStatus, t)}</Badge></td>
		<td className="p-3 text-end font-medium">{money(order.total, order.currencySymbol)}</td>
		<td className="p-3 text-end"><Button size="sm" variant="outline" onClick={onClick}>{t`View details`}</Button></td>
	</tr>;
}

function OrderDetailPanel({ order }: { order: ShopOrderDetail }) {
	const { t } = useLingui();
	const toastManager = Toast.useToastManager();
	const queryClient = useQueryClient();
	const paymentMutation = useMutation({ mutationFn: () => confirmShopPayment(order.id), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["shop", "orders"] }); toastManager.add({ title: t`Payment confirmed`, type: "success" }); } });
	const deliveryMutation = useMutation({ mutationFn: (status: string) => updateShopDelivery(order.id, { status }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["shop", "orders"] }); void queryClient.invalidateQueries({ queryKey: ["shop", "order", order.id] }); toastManager.add({ title: t`Delivery updated`, type: "success" }); } });
	const customerName = typeof order.customer.name === "string" ? order.customer.name : t`Customer`;
	const address = typeof order.delivery.address === "string" ? order.delivery.address : "";
	return <div className="space-y-4 rounded-lg border p-5">
		<div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{order.orderNumber}</h2><span className="font-medium">{money(order.total, order.currencySymbol)}</span></div>
		<div><p className="font-medium">{customerName}</p><p className="text-sm text-kumo-subtle">{address}</p></div>
		<div className="space-y-2">{order.items.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span>{item.productName} × {item.quantity}</span><span>{money(item.subtotal, order.currencySymbol)}</span></div>)}</div>
		<div className="grid gap-2 text-sm"><span>{t`Payment`}: {formatStatus(order.paymentStatus, t)}</span><span>{t`Delivery`}: {formatStatus(order.deliveryStatus, t)}</span></div>
		<div className="flex flex-wrap gap-2">
			{order.paymentStatus !== "confirmed" ? <Button size="sm" icon={<CheckCircle />} onClick={() => paymentMutation.mutate()} disabled={paymentMutation.isPending}>{t`Confirm payment`}</Button> : null}
			<Select aria-label={t`Update delivery status`} value={order.deliveryStatus} onValueChange={(value) => { if (value) deliveryMutation.mutate(value); }} items={{ pending: t`Pending`, assigned: t`Assigned`, in_transit: t`In transit`, delivered: t`Delivered`, not_delivered: t`Not delivered` }} />
		</div>
	</div>;
}

function LoadingState({ label }: { label: string }) {
	return <div className="flex items-center gap-2 text-sm text-kumo-subtle"><Loader /><span>{label}</span></div>;
}

function ErrorState({ label }: { label: string }) {
	return <p className="rounded-lg border border-kumo-danger p-6 text-sm text-kumo-danger">{label}</p>;
}
