import 'package:flutter/material.dart';

import '../../../core/data/audit_log_labels.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../data/supervision_models.dart';

const _kAllActions = '__ALL__';

/// Miroir de AuditLogPanel.jsx + AuditLogTable.jsx — filtre par action,
/// case "afficher les connexions", pagination. Un seul widget, paramétré
/// par un [fetchPage] callback plutôt que par une URL brute (Dio n'est pas
/// directement exposé ici) — utilisé aujourd'hui par le Journal de
/// Supervision, réutilisable tel quel plus tard pour un éventuel Journal
/// d'activité de sa propre boutique.
class AuditLogPanel extends StatefulWidget {
  const AuditLogPanel({super.key, required this.fetchPage});

  final Future<AuditLogListResult> Function({
    required int page,
    String? action,
    required bool includeLogins,
  }) fetchPage;

  @override
  State<AuditLogPanel> createState() => _AuditLogPanelState();
}

class _AuditLogPanelState extends State<AuditLogPanel> {
  int _page = 1;
  int _pages = 1;
  int _total = 0;
  String _action = _kAllActions;
  bool _includeLogins = false;
  bool _loading = true;
  String? _error;
  List<AuditLogEntry> _logs = const [];
  final Set<int> _expanded = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await widget.fetchPage(
        page: _page,
        action: _action == _kAllActions ? null : _action,
        includeLogins: _includeLogins,
      );
      if (!mounted) return;
      setState(() {
        _logs = result.logs;
        _pages = result.pages;
        _total = result.total;
      });
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _goToPage(int page) {
    setState(() => _page = page);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    // ListView plutôt que Column : ce panneau est utilisé comme enfant
    // direct d'un TabBarView (hauteur bornée mais potentiellement plus
    // petite que le contenu — filtre + liste + pagination), donc doit
    // pouvoir défiler comme les autres onglets plutôt que de déborder.
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                initialValue: _action,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Action',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
                items: [
                  const DropdownMenuItem(value: _kAllActions, child: Text('Toutes les actions')),
                  for (final group in kAuditActionGroups)
                    if (_includeLogins || group.label != 'Connexion')
                      ...group.actions.map(
                        (a) => DropdownMenuItem(
                          value: a,
                          child: Text(
                            '${group.label} — ${auditActionLabel(a)}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                ],
                onChanged: (value) {
                  setState(() {
                    _page = 1;
                    _action = value ?? _kAllActions;
                  });
                  _load();
                },
              ),
            ),
          ],
        ),
        CheckboxListTile(
          value: _includeLogins,
          onChanged: (checked) {
            setState(() {
              _page = 1;
              _includeLogins = checked ?? false;
              if (!_includeLogins && _action == 'LOGIN') _action = _kAllActions;
            });
            _load();
          },
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
          dense: true,
          title: const Text('Afficher les connexions', style: TextStyle(fontSize: 13)),
        ),
        const SizedBox(height: 8),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
          ),
        if (_loading)
          const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: CircularProgressIndicator()))
        else if (_logs.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 30),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Center(
              child: Text("Aucune activité pour l'instant.", style: TextStyle(color: Colors.grey.shade500)),
            ),
          )
        else
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              children: [
                for (var i = 0; i < _logs.length; i++) ...[
                  if (i > 0) const Divider(height: 1),
                  _AuditLogTile(
                    log: _logs[i],
                    expanded: _expanded.contains(_logs[i].id),
                    onToggle: () => setState(() {
                      if (!_expanded.add(_logs[i].id)) _expanded.remove(_logs[i].id);
                    }),
                  ),
                ],
              ],
            ),
          ),
        if (!_loading && _total > 0) ...[
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Page $_page / $_pages ($_total entrée${_total > 1 ? 's' : ''})',
                  style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500)),
              Row(
                children: [
                  IconButton(
                    onPressed: _page > 1 ? () => _goToPage(_page - 1) : null,
                    icon: const Icon(Icons.chevron_left),
                    tooltip: 'Précédent',
                  ),
                  IconButton(
                    onPressed: _page < _pages ? () => _goToPage(_page + 1) : null,
                    icon: const Icon(Icons.chevron_right),
                    tooltip: 'Suivant',
                  ),
                ],
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _AuditLogTile extends StatelessWidget {
  const _AuditLogTile({required this.log, required this.expanded, required this.onToggle});

  final AuditLogEntry log;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final details = formatAuditLogDetails(log.action, log.details);
    return InkWell(
      onTap: onToggle,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        log.userFullName ?? log.userEmail ?? '—',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13.5),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(auditActionLabel(log.action),
                            style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Colors.grey.shade700)),
                      ),
                    ],
                  ),
                ),
                Icon(expanded ? Icons.expand_less : Icons.expand_more, color: Colors.grey.shade400),
              ],
            ),
            if (expanded) ...[
              const SizedBox(height: 8),
              Text('Date : ${formatDateTime(log.createdAt)}', style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600)),
              const SizedBox(height: 2),
              Text('Détails : ${details ?? '—'}', style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600)),
            ],
          ],
        ),
      ),
    );
  }
}
