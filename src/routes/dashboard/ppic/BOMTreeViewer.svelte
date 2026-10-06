<script lang="ts">
	import {
		ChevronDown,
		ChevronRight,
		CornerDownRight,
		AlertTriangle,
		CheckCircle2,
		XCircle,
		Search,
		Download,
		Pencil,
		RotateCcw,
		RefreshCw,
		Check,
		X,
		CheckSquare,
		Square
	} from '@lucide/svelte';
	import { getDeptBadgeClass, type SpkPlanTree, type PlanTreeNode } from '$lib/domain/material';
	import { toast } from '$lib/toast.svelte';
	import { ItemCombobox, type ItemOption } from '$lib/components';

	interface Props {
		trees: SpkPlanTree[];
		planId?: string;
		source?: 'spk' | 'so';
		exportMode?: 'full' | 'simple' | 'no-tree' | 'erp-china';
	}

	let {
		trees = [],
		planId = undefined,
		source = 'spk',
		exportMode = $bindable('full')
	}: Props = $props();

	// Search & Filter state
	let searchQuery = $state('');
	let onlyIssues = $state(false);

	// Node expansion state
	let expandedNodes = $state<Record<string, boolean>>({});
	let expandedOrders = $state<Record<string, boolean>>({});

	// Checkbox state (default: semua item terpilih)
	let checkedNodes = $state<Record<string, boolean>>({});

	// Penyesuaian Kebutuhan (Custom Quantity per node.id)
	let customQuantities = $state<Record<string, number>>({});
	let editingQtyNodeId = $state<string | null>(null);
	let tempQtyInput = $state<string>('');

	// Penyesuaian Substitusi Bahan (Replacement Item per node.id)
	let substitutions = $state<Record<string, { itemId: string; itemName: string }>>({});
	let substitutingNodeId = $state<string | null>(null);

	// Loading export
	let exportLoading = $state(false);

	// Inisialisasi: otomatis buka level 1 dan 2
	$effect(() => {
		const orderMap: Record<string, boolean> = {};
		const nodeMap: Record<string, boolean> = {};
		for (const t of trees) {
			const oKey = `${t.noSPK}_${t.kodeBarang}`;
			if (expandedOrders[oKey] === undefined) {
				orderMap[oKey] = true;
			}
			const initNodes = (nodes: PlanTreeNode[]) => {
				for (const n of nodes) {
					if (expandedNodes[n.id] === undefined) {
						nodeMap[n.id] = n.level <= 2;
					}
					if (n.children && n.children.length > 0) {
						initNodes(n.children);
					}
				}
			};
			initNodes(t.tree);
		}
		if (Object.keys(orderMap).length > 0) expandedOrders = { ...expandedOrders, ...orderMap };
		if (Object.keys(nodeMap).length > 0) expandedNodes = { ...expandedNodes, ...nodeMap };
	});

	function toggleOrder(key: string) {
		expandedOrders[key] = !expandedOrders[key];
	}

	function toggleNode(nodeId: string) {
		expandedNodes[nodeId] = !expandedNodes[nodeId];
	}

	function expandAll() {
		const oMap: Record<string, boolean> = {};
		const nMap: Record<string, boolean> = {};
		for (const t of trees) {
			oMap[`${t.noSPK}_${t.kodeBarang}`] = true;
			const mark = (nodes: PlanTreeNode[]) => {
				for (const n of nodes) {
					nMap[n.id] = true;
					if (n.children) mark(n.children);
				}
			};
			mark(t.tree);
		}
		expandedOrders = oMap;
		expandedNodes = nMap;
	}

	function collapseAll() {
		const nMap: Record<string, boolean> = {};
		for (const t of trees) {
			const mark = (nodes: PlanTreeNode[]) => {
				for (const n of nodes) {
					nMap[n.id] = false;
					if (n.children) mark(n.children);
				}
			};
			mark(t.tree);
		}
		expandedNodes = nMap;
	}

	function fmt(n: number): string {
		return Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });
	}

	// --- Checkbox Helpers ---
	function isNodeChecked(node: PlanTreeNode): boolean {
		return checkedNodes[node.id] !== false; // default true jika belum di-uncheck
	}

	function toggleNodeCheck(node: PlanTreeNode) {
		const nextState = !isNodeChecked(node);
		const newChecked = { ...checkedNodes };
		const applyRecursive = (n: PlanTreeNode) => {
			newChecked[n.id] = nextState;
			if (n.children) {
				for (const c of n.children) applyRecursive(c);
			}
		};
		applyRecursive(node);
		checkedNodes = newChecked;
	}

	function selectAllNodes() {
		const newChecked: Record<string, boolean> = {};
		const mark = (nodes: PlanTreeNode[]) => {
			for (const n of nodes) {
				newChecked[n.id] = true;
				if (n.children) mark(n.children);
			}
		};
		for (const t of trees) mark(t.tree);
		checkedNodes = newChecked;
	}

	function deselectAllNodes() {
		const newChecked: Record<string, boolean> = {};
		const mark = (nodes: PlanTreeNode[]) => {
			for (const n of nodes) {
				newChecked[n.id] = false;
				if (n.children) mark(n.children);
			}
		};
		for (const t of trees) mark(t.tree);
		checkedNodes = newChecked;
	}

	// --- Penyesuaian Kebutuhan QTY ---
	function getNodeNeeded(node: PlanTreeNode): number {
		return customQuantities[node.id] !== undefined ? customQuantities[node.id] : node.totalNeeded;
	}

	function getNodeShortage(node: PlanTreeNode): number {
		const needed = getNodeNeeded(node);
		return Math.max(0, needed - node.available);
	}

	function getNodeStatus(node: PlanTreeNode): 'AMAN' | 'KURANG' | 'HABIS' {
		const needed = getNodeNeeded(node);
		if (needed <= 0) return 'AMAN';
		if (node.available <= 0) return 'HABIS';
		if (node.available < needed) return 'KURANG';
		return 'AMAN';
	}

	function startEditQty(node: PlanTreeNode) {
		substitutingNodeId = null;
		editingQtyNodeId = node.id;
		tempQtyInput = String(getNodeNeeded(node));
	}

	function saveEditQty(node: PlanTreeNode) {
		const val = parseFloat(tempQtyInput.replace(',', '.'));
		if (!Number.isNaN(val) && val >= 0) {
			customQuantities[node.id] = val;
		}
		editingQtyNodeId = null;
	}

	function resetEditQty(node: PlanTreeNode) {
		delete customQuantities[node.id];
		customQuantities = { ...customQuantities };
		if (editingQtyNodeId === node.id) editingQtyNodeId = null;
	}

	// --- Penyesuaian Substitusi Bahan ---
	function getNodeItem(node: PlanTreeNode) {
		if (substitutions[node.id]) {
			return {
				itemId: substitutions[node.id].itemId,
				itemName: substitutions[node.id].itemName,
				isSubstituted: true,
				originalItemId: node.itemId
			};
		}
		return {
			itemId: node.itemId,
			itemName: node.itemName,
			isSubstituted: false,
			originalItemId: undefined
		};
	}

	// Opsi bahan yang ada di dalam BOM ini untuk saran instan di combobox
	let bomSuggestedItems = $derived.by<ItemOption[]>(() => {
		const map = new Map<string, ItemOption>();
		const visit = (nodes: PlanTreeNode[]) => {
			for (const n of nodes) {
				if (n.itemId && !map.has(n.itemId)) {
					map.set(n.itemId, {
						ItemID: n.itemId,
						ItemName: n.itemName,
						Departemen: n.departemen
					});
				}
				if (n.children && n.children.length > 0) visit(n.children);
			}
		};
		for (const t of trees) visit(t.tree);
		return Array.from(map.values());
	});

	function startSubstitute(node: PlanTreeNode) {
		editingQtyNodeId = null;
		substitutingNodeId = node.id;
	}

	function handleSubstituteSelect(node: PlanTreeNode, item: ItemOption) {
		substitutions[node.id] = {
			itemId: item.ItemID.trim().toUpperCase(),
			itemName: item.ItemName.trim() || item.ItemID.trim().toUpperCase()
		};
		substitutingNodeId = null;
		toast.info('Bahan Diganti', `${node.itemId} diganti dengan ${item.ItemID}`);
	}

	function handleSubstituteCancel() {
		substitutingNodeId = null;
	}

	function resetSubstitute(node: PlanTreeNode) {
		delete substitutions[node.id];
		substitutions = { ...substitutions };
		if (substitutingNodeId === node.id) substitutingNodeId = null;
		toast.info('Substitusi Dibatalkan', `Kembali ke ${node.itemId}`);
	}

	// --- Perhitungan Statistik Global ---
	let globalStats = $derived.by(() => {
		let total = 0;
		let checked = 0;
		let aman = 0;
		let kurang = 0;
		let habis = 0;

		const countNode = (n: PlanTreeNode) => {
			total++;
			if (isNodeChecked(n)) {
				checked++;
				const st = getNodeStatus(n);
				if (st === 'AMAN') aman++;
				else if (st === 'KURANG') kurang++;
				else if (st === 'HABIS') habis++;
			}
			if (n.children) {
				for (const c of n.children) countNode(c);
			}
		};

		for (const t of trees) {
			for (const root of t.tree) countNode(root);
		}

		return { total, checked, aman, kurang, habis, issues: kurang + habis };
	});

	function nodeMatches(node: PlanTreeNode): boolean {
		if (onlyIssues && getNodeStatus(node) === 'AMAN') return false;
		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			const info = getNodeItem(node);
			return (
				info.itemId.toLowerCase().includes(q) ||
				info.itemName.toLowerCase().includes(q) ||
				node.departemen.toLowerCase().includes(q)
			);
		}
		return true;
	}

	function nodeOrDescendantsMatch(node: PlanTreeNode): boolean {
		if (nodeMatches(node)) return true;
		if (node.children && node.children.length > 0) {
			return node.children.some((c) => nodeOrDescendantsMatch(c));
		}
		return false;
	}

	function getFilteredTree(treeNodes: PlanTreeNode[]): PlanTreeNode[] {
		if (!searchQuery.trim() && !onlyIssues) return treeNodes;
		return treeNodes.filter((n) => nodeOrDescendantsMatch(n));
	}

	// --- Export Excel Sesuai Template Pilihan & Penyesuaian di Tree ---
	async function exportWithTemplate() {
		if (globalStats.checked === 0) {
			toast.error('Perhatian', 'Pilih minimal satu bahan (centang) untuk di-export.');
			return;
		}

		exportLoading = true;
		try {
			// Kumpulkan daftar item yang di-uncheck, custom quantities, dan substitusi
			const excludedItemIds: string[] = [];
			const qtyAdjustments: Record<string, number> = {};
			const substAdjustments: Record<string, { itemId: string; itemName: string }> = {};

			const visit = (nodes: PlanTreeNode[]) => {
				for (const n of nodes) {
					if (!isNodeChecked(n)) {
						excludedItemIds.push(n.itemId);
					}
					if (customQuantities[n.id] !== undefined) {
						qtyAdjustments[n.itemId] = customQuantities[n.id];
					}
					if (substitutions[n.id]) {
						substAdjustments[n.itemId] = substitutions[n.id];
					}
					if (n.children && n.children.length > 0) visit(n.children);
				}
			};
			for (const t of trees) visit(t.tree);

			const spks = trees.map((t) => t.noSPK).filter(Boolean);

			const res = await fetch('/api/export', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					planId,
					spks,
					source,
					mode: exportMode,
					adjustments: {
						excludedItemIds,
						customQuantities: qtyAdjustments,
						substitutions: substAdjustments
					}
				})
			});

			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				throw new Error(errData.error || 'Gagal export Excel');
			}

			const blob = await res.blob();
			const contentDisp = res.headers.get('Content-Disposition') || '';
			const filenameMatch = contentDisp.match(/filename="?([^";]+)"?/);
			const filename = filenameMatch ? filenameMatch[1] : `Plan_PPIC_${exportMode}.xlsx`;

			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);

			const modeLabel =
				exportMode === 'full'
					? 'Detail (Tree)'
					: exportMode === 'simple'
						? 'Simpel (Tree)'
						: exportMode === 'no-tree'
							? 'Tanpa Tree'
							: 'ERP China';

			toast.success(
				'Berhasil Export',
				`File Excel format ${modeLabel} (${globalStats.checked} bahan) berhasil diunduh.`
			);
		} catch (err: any) {
			toast.error('Gagal', err?.message || 'Gagal export Excel');
		} finally {
			exportLoading = false;
		}
	}
</script>

{#snippet renderNodeRow(node: PlanTreeNode, isLast: boolean, parentExpanded: boolean)}
	{@const hasChildren = node.children && node.children.length > 0}
	{@const isExpanded = expandedNodes[node.id] ?? false}
	{@const matchesSelf = nodeMatches(node)}
	{@const filteredChildren = (node.children || []).filter((c) => nodeOrDescendantsMatch(c))}

	{@const isChecked = isNodeChecked(node)}
	{@const needed = getNodeNeeded(node)}
	{@const shortage = getNodeShortage(node)}
	{@const status = getNodeStatus(node)}
	{@const isSafe = status === 'AMAN'}
	{@const isShort = status === 'KURANG'}
	{@const isEmpty = status === 'HABIS'}
	{@const isQtyModified = customQuantities[node.id] !== undefined}
	{@const itemInfo = getNodeItem(node)}
	{@const isEditingThisQty = editingQtyNodeId === node.id}
	{@const isSubstitutingThis = substitutingNodeId === node.id}

	{#if parentExpanded}
		<tr class="border-b border-border/30 hover:bg-muted/40 transition-colors text-xs
			{!isChecked ? 'opacity-35 bg-muted/20' : matchesSelf ? '' : 'opacity-40'}
			{isChecked && isEmpty ? 'bg-destructive/5' : isChecked && isShort ? 'bg-warning/5' : ''}">

			<!-- Checkbox Centang Bahan -->
			<td class="w-8 py-1.5 pl-2.5 pr-1 text-center align-middle">
				<input
					type="checkbox"
					checked={isChecked}
					onchange={() => toggleNodeCheck(node)}
					class="size-3.5 rounded border-2 border-border text-primary focus:ring-0 cursor-pointer"
					title={isChecked ? 'Hilangkan centang untuk melewati bahan ini' : 'Centang untuk menyertakan bahan ini'}
				/>
			</td>

			<!-- Kolom Nama Bahan & Kode dengan Garis/Panah Cabang dan Indentasi Rapi -->
			<td class="py-1.5 pr-2 font-medium" style="padding-left: {(node.level - 1) * 20 + 4}px;">
				<div class="flex items-center gap-1.5">
					<!-- Panah cabang hierarki pohon untuk sub-komponen (level > 1) -->
					{#if node.level > 1}
						<span class="flex items-center text-primary/70 shrink-0" title={`Sub-komponen tingkat ${node.level}`}>
							<CornerDownRight class="size-3.5 stroke-[2.5]" />
						</span>
					{/if}

					{#if hasChildren}
						<button
							type="button"
							onclick={() => toggleNode(node.id)}
							class="flex size-4.5 shrink-0 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
							title={isExpanded ? 'Tutup sub-komponen' : 'Buka sub-komponen'}
						>
							{#if isExpanded}
								<ChevronDown class="size-3.5 stroke-[2.5]" />
							{:else}
								<ChevronRight class="size-3.5 stroke-[2.5]" />
							{/if}
						</button>
					{:else}
						<span class="flex size-4.5 shrink-0 items-center justify-center text-muted-foreground/30">
							<span class="size-1 rounded-full bg-border"></span>
						</span>
					{/if}

					<div class="flex flex-wrap items-baseline gap-1.5 min-w-0">
						<!-- Nama & Kode Barang (atau Substitusi) -->
						{#if isSubstitutingThis}
							<div class="inline-flex items-center gap-1.5 py-0.5">
								<ItemCombobox
									value={substitutions[node.id]?.itemId || ''}
									placeholder="Ketik kode barang..."
									suggestedItems={bomSuggestedItems}
									onselect={(item) => handleSubstituteSelect(node, item)}
									oncancel={handleSubstituteCancel}
								/>
							</div>
						{:else}
							<span class="font-bold text-foreground truncate {!isChecked ? 'line-through' : ''}" title={itemInfo.itemName}>
								{itemInfo.itemName}
							</span>
							<span class="font-mono text-[11px] text-muted-foreground">
								({itemInfo.itemId})
							</span>

							<!-- Badge Penyesuaian Substitusi -->
							{#if itemInfo.isSubstituted}
								<span class="rounded bg-primary/10 text-primary border border-primary/30 px-1.5 py-0.2 font-mono text-[9px] font-black uppercase inline-flex items-center gap-1">
									Substitusi dari {itemInfo.originalItemId}
									<button
										type="button"
										onclick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											startSubstitute(node);
										}}
										class="text-primary hover:underline cursor-pointer ml-0.5 font-bold"
										title="Pilih ulang bahan pengganti"
									>
										[Ubah]
									</button>
									<button
										type="button"
										onclick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											resetSubstitute(node);
										}}
										class="text-destructive hover:font-bold cursor-pointer"
										title="Kembalikan ke bahan asli"
									>
										↺
									</button>
								</span>
							{:else}
								<button
									type="button"
									onclick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										startSubstitute(node);
									}}
									class="text-[10px] text-muted-foreground/60 hover:text-primary hover:underline cursor-pointer ml-1 font-bold"
									title="Ganti dengan bahan substitusi (pencarian kode barang)"
								>
									[Ganti]
								</button>
							{/if}
						{/if}
					</div>
				</div>
			</td>

			<!-- Kolom Departemen -->
			<td class="py-1.5 px-2 text-center w-24 whitespace-nowrap">
				<span class="rounded border px-1.5 py-0.2 font-mono text-[10px] font-bold uppercase {getDeptBadgeClass(node.departemen)}">
					{node.departemen || 'GUDANG'}
				</span>
			</td>

			<!-- Kolom Kebutuhan (Dapat Diedit Langsung) -->
			<td class="py-1.5 px-2 text-right font-mono font-bold w-28 whitespace-nowrap">
				{#if isEditingThisQty}
					<div class="inline-flex items-center gap-1 justify-end">
						<input
							type="number"
							step="any"
							bind:value={tempQtyInput}
							class="h-6 w-16 border rounded px-1 text-right font-mono text-xs font-black bg-background"
							onkeydown={(e) => {
								if (e.key === 'Enter') saveEditQty(node);
								if (e.key === 'Escape') editingQtyNodeId = null;
							}}
						/>
						<button
							type="button"
							onclick={() => saveEditQty(node)}
							class="size-5 rounded bg-primary text-primary-foreground flex items-center justify-center cursor-pointer"
							title="Terapkan kuantitas"
						>
							<Check class="size-3" />
						</button>
						<button
							type="button"
							onclick={() => (editingQtyNodeId = null)}
							class="size-5 rounded bg-muted text-muted-foreground flex items-center justify-center cursor-pointer"
							title="Batal"
						>
							<X class="size-3" />
						</button>
					</div>
				{:else}
					<div class="inline-flex items-center gap-1 justify-end group">
						{#if isQtyModified}
							<button
								type="button"
								onclick={() => resetEditQty(node)}
								class="text-warning hover:text-destructive cursor-pointer text-[10px]"
								title="Kembalikan ke kuantitas hitungan sistem"
							>
								↺
							</button>
							<span class="text-primary font-black underline decoration-dashed" title="Kuantitas disesuaikan manual">
								{fmt(needed)}
							</span>
						{:else}
							<span>{fmt(needed)}</span>
						{/if}

						<button
							type="button"
							onclick={() => startEditQty(node)}
							class="opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity cursor-pointer p-0.5"
							title="Ubah angka kebutuhan"
						>
							<Pencil class="size-2.5 text-muted-foreground" />
						</button>
					</div>
				{/if}
			</td>

			<!-- Kolom Stok Gudang -->
			<td class="py-1.5 px-2 text-right font-mono w-24 whitespace-nowrap {node.available <= 0 ? 'text-destructive font-bold' : ''}">
				{fmt(node.available)}
				{#if node.qtyReserved > 0}
					<span class="block text-[9px] text-warning" title={`Direservasi SPK lain: ${fmt(node.qtyReserved)}`}>
						(res: {fmt(node.qtyReserved)})
					</span>
				{/if}
			</td>

			<!-- Kolom Status -->
			<td class="py-1.5 pl-2 pr-3 text-right w-28 whitespace-nowrap">
				{#if !isChecked}
					<span class="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
						Dilewati
					</span>
				{:else if isSafe}
					<span class="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-0.5 font-mono text-[10px] font-bold text-success">
						<CheckCircle2 class="size-3" /> Cukup
					</span>
				{:else if isShort}
					<span class="inline-flex items-center gap-1 rounded bg-warning/20 px-2 py-0.5 font-mono text-[10px] font-black text-warning-foreground">
						<AlertTriangle class="size-3 text-warning" /> Kurang {fmt(shortage)}
					</span>
				{:else}
					<span class="inline-flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 font-mono text-[10px] font-black text-destructive">
						<XCircle class="size-3" /> Kosong (-{fmt(needed)})
					</span>
				{/if}
			</td>
		</tr>

		<!-- Anak komponen rekursif -->
		{#if hasChildren && isExpanded}
			{#each filteredChildren as child, cIdx (child.id)}
				{@render renderNodeRow(child, cIdx === filteredChildren.length - 1, true)}
			{/each}
		{/if}
	{/if}
{/snippet}

<div class="space-y-2">
	<!-- Bar Kontrol Ringkas & Sederhana (Dengan Export Excel Tree) -->
	<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-border bg-card px-3 py-1.5 text-xs">
		<!-- Kiri: Pencarian & Filter Cepat -->
		<div class="flex items-center gap-2 flex-1 min-w-44">
			<Search class="size-3.5 text-muted-foreground shrink-0" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Cari nama bahan / kode..."
				class="h-7 w-full bg-transparent text-xs font-bold outline-none placeholder:text-muted-foreground/60"
			/>
		</div>

		<!-- Tengah & Kanan: Filter, Toggles, dan Tombol Export Excel -->
		<div class="flex flex-wrap items-center gap-2 shrink-0">
			<!-- Counter Centang & Toggle Pilih -->
			<div class="flex items-center gap-1.5 font-mono text-[11px] bg-muted/40 px-2 py-0.5 rounded border border-border/50">
				<span class="font-bold">
					{globalStats.checked}/{globalStats.total}
				</span>
				<span class="text-muted-foreground text-[10px]">Dipilih</span>
				<button
					type="button"
					onclick={() => (globalStats.checked === globalStats.total ? deselectAllNodes() : selectAllNodes())}
					class="text-primary hover:underline text-[10px] font-bold cursor-pointer ml-1"
				>
					{globalStats.checked === globalStats.total ? 'Batal Semua' : 'Pilih Semua'}
				</button>
			</div>

			<!-- Filter Hanya Kurang -->
			<button
				type="button"
				onclick={() => (onlyIssues = !onlyIssues)}
				class="rounded border px-2 py-0.5 font-mono text-[11px] font-bold cursor-pointer transition-colors
					{onlyIssues ? 'border-destructive bg-destructive text-white' : 'border-border bg-muted/50 hover:bg-muted text-foreground'}"
			>
				{#if onlyIssues}
					⚠️ Hanya Yang Kurang ({globalStats.issues})
				{:else}
					Semua ({globalStats.total})
				{/if}
			</button>

			<span class="text-border">|</span>

			<!-- Buka / Tutup All -->
			<button
				type="button"
				onclick={expandAll}
				class="font-mono text-[11px] text-muted-foreground hover:text-foreground cursor-pointer px-1"
			>
				Buka
			</button>
			<button
				type="button"
				onclick={collapseAll}
				class="font-mono text-[11px] text-muted-foreground hover:text-foreground cursor-pointer px-1"
			>
				Tutup
			</button>

			<span class="text-border">|</span>

			<!-- Selector Format Template Excel (Sama dengan pilihan di atas) -->
			<div class="flex items-center gap-1 bg-background border-2 border-border rounded px-1.5 py-0.5 brutal-shadow-2xs">
				<span class="text-[10px] font-mono text-muted-foreground font-bold uppercase hidden xl:inline">Template:</span>
				<select
					bind:value={exportMode}
					aria-label="Format Template Excel"
					title="Pilih Format Template Excel"
					class="bg-transparent font-mono text-[11px] font-bold text-foreground cursor-pointer focus:outline-none"
				>
					<option value="full">Format: Detail (Tree Hierarki)</option>
					<option value="simple">Format: Simpel (Tree Hierarki)</option>
					<option value="no-tree">Format: Tanpa Tree (Daftar Material)</option>
					<option value="erp-china">Format: ERP China (生产单)</option>
				</select>
			</div>

			<!-- Tombol Export Excel -->
			<button
				type="button"
				onclick={exportWithTemplate}
				disabled={exportLoading || globalStats.checked === 0}
				class="inline-flex items-center gap-1.5 rounded border-2 border-border bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 font-mono text-[11px] font-black uppercase tracking-wide transition-all brutal-shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
				title={`Export Excel template ${exportMode} sesuai penyesuaian di pohon BOM`}
			>
				{#if exportLoading}
					<RefreshCw class="size-3 animate-spin" />
					<span>Mengekspor...</span>
				{:else}
					<Download class="size-3.5" />
					<span>Export Excel ({globalStats.checked})</span>
				{/if}
			</button>
		</div>
	</div>

	<!-- Tabel Pohon Komponen yang Ringkas & Interaktif -->
	{#if trees.length === 0}
		<p class="py-4 text-center text-xs text-muted-foreground">Tidak ada data bahan untuk ditampilkan.</p>
	{:else}
		<div class="space-y-3">
			{#each trees as orderTree, oIdx (`${orderTree.noSPK}_${orderTree.kodeBarang}_${oIdx}`)}
				{@const oKey = `${orderTree.noSPK}_${orderTree.kodeBarang}`}
				{@const isOrderOpen = expandedOrders[oKey] ?? true}
				{@const filteredNodes = getFilteredTree(orderTree.tree)}
				{@const isOrderSafe = orderTree.stats.kurang === 0 && orderTree.stats.habis === 0}

				<div class="overflow-hidden rounded-lg border-2 border-border bg-card">
					<!-- Header Dokumen Ringkas (hanya jika ada lebih dari 1 order) -->
					{#if trees.length > 1}
						<button
							type="button"
							onclick={() => toggleOrder(oKey)}
							class="flex w-full items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-bold text-left cursor-pointer hover:bg-muted/70 transition-colors"
						>
							<div class="flex items-center gap-2 truncate">
								{#if isOrderOpen}
									<ChevronDown class="size-3.5 text-primary shrink-0" />
								{:else}
									<ChevronRight class="size-3.5 text-muted-foreground shrink-0" />
								{/if}
								<span class="font-mono font-black">{orderTree.noSPK}</span>
								<span class="truncate text-foreground">— {orderTree.namaBarang || orderTree.kodeBarang}</span>
								<span class="text-muted-foreground font-mono">({fmt(orderTree.targetQty)} pcs)</span>
							</div>

							<div class="shrink-0 font-mono text-[10px] font-bold">
								{#if isOrderSafe}
									<span class="text-success font-black">✓ Bahan Cukup</span>
								{:else}
									<span class="text-destructive font-black">⚠️ {orderTree.stats.kurang + orderTree.stats.habis} Kurang</span>
								{/if}
							</div>
						</button>
					{/if}

					<!-- Konten Tabel Pohon -->
					{#if isOrderOpen}
						<div class="overflow-x-auto">
							<table class="w-full border-collapse text-left">
								<thead>
									<tr class="border-b-2 border-border bg-muted/50 font-mono text-[10px] font-black uppercase text-muted-foreground">
										<th class="w-8 py-1 pl-2.5 pr-1 text-center">✓</th>
										<th class="py-1 px-3">Bahan / Komponen</th>
										<th class="py-1 px-2 text-center w-24">Dept</th>
										<th class="py-1 px-2 text-right w-28">Butuh</th>
										<th class="py-1 px-2 text-right w-24">Stok</th>
										<th class="py-1 pl-2 pr-3 text-right w-28">Status</th>
									</tr>
								</thead>
								<tbody>
									{#if filteredNodes.length === 0}
										<tr>
											<td colspan={6} class="py-4 text-center text-xs text-muted-foreground">
												Tidak ada bahan yang cocok dengan pencarian / filter.
											</td>
										</tr>
									{:else}
										{#each filteredNodes as rootNode, rIdx (rootNode.id)}
											{@render renderNodeRow(rootNode, rIdx === filteredNodes.length - 1, true)}
										{/each}
									{/if}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
