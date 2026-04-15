import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

void main() {
  runApp(const ShareInstallsDemoApp());
}

class ShareInstallsDemoApp extends StatelessWidget {
  const ShareInstallsDemoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ShareInstalls SDK Demo',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6366F1),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
        fontFamily: 'Inter',
      ),
      home: const DemoHomePage(),
    );
  }
}

class DemoHomePage extends StatefulWidget {
  const DemoHomePage({super.key});

  @override
  State<DemoHomePage> createState() => _DemoHomePageState();
}

class _DemoHomePageState extends State<DemoHomePage> {
  static const _channel = MethodChannel('com.shareinstalls/sdk');

  final _apiUrlController = TextEditingController(
    text: 'https://console.share-installs.com/api',
  );
  final _apiKeyController = TextEditingController();

  bool _isConfigured = false;
  bool _isLoading = false;
  String? _resolveResult;
  final List<_LogEntry> _logs = [];

  @override
  void dispose() {
    _apiUrlController.dispose();
    _apiKeyController.dispose();
    super.dispose();
  }

  void _addLog(String level, String message) {
    setState(() {
      _logs.insert(
        0,
        _LogEntry(level: level, message: message, time: DateTime.now()),
      );
    });
  }

  Future<void> _configureSDK() async {
    setState(() => _isLoading = true);
    _addLog('info', 'Configuring SDK with: ${_apiUrlController.text}');

    try {
      final result = await _channel.invokeMethod('configure', {
        'apiBaseUrl': _apiUrlController.text.trim(),
        'apiKey': _apiKeyController.text.trim().isEmpty
            ? null
            : _apiKeyController.text.trim(),
        'debug': true,
      });
      setState(() => _isConfigured = true);
      _addLog('success', 'SDK configured successfully: $result');
    } on PlatformException catch (e) {
      _addLog('error', 'Configure failed: ${e.message}');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _resolveDeferred() async {
    if (!_isConfigured) {
      _addLog('warn', 'SDK not configured yet');
      return;
    }
    setState(() {
      _isLoading = true;
      _resolveResult = null;
    });
    _addLog('info', 'Resolving deferred invite...');

    try {
      final result = await _channel.invokeMethod('resolveDeferred');
      if (result != null) {
        final map = Map<String, dynamic>.from(result as Map);
        final prettyJson = const JsonEncoder.withIndent('  ').convert(map);
        setState(() => _resolveResult = prettyJson);
        _addLog(
          'success',
          'Invite resolved: code=${map['code']}, confidence=${map['confidence']}, channel=${map['channel']}',
        );
      } else {
        setState(() => _resolveResult = '{ "matched": false }');
        _addLog('warn', 'No matching invite found');
      }
    } on PlatformException catch (e) {
      _addLog('error', 'Resolve failed: ${e.message}');
      setState(() => _resolveResult = '{ "error": "${e.message}" }');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _clearCache() async {
    try {
      await _channel.invokeMethod('clearCache');
      _addLog('info', 'Resolution cache cleared');
    } on PlatformException catch (e) {
      _addLog('error', 'Clear cache failed: ${e.message}');
    }
  }

  Future<void> _getSDKInfo() async {
    try {
      final result = await _channel.invokeMethod('getSDKInfo');
      if (result != null) {
        final map = Map<String, dynamic>.from(result as Map);
        _addLog(
          'info',
          'SDK Info: version=${map['version']}, platform=${map['platform']}, configured=${map['configured']}',
        );
      }
    } on PlatformException catch (e) {
      _addLog('error', 'Get info failed: ${e.message}');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // App Bar
          SliverAppBar.large(
            title: const Text('ShareInstalls Demo'),
            actions: [
              IconButton(
                onPressed: _getSDKInfo,
                icon: const Icon(Icons.info_outline),
                tooltip: 'SDK Info',
              ),
            ],
          ),

          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList.list(
              children: [
                // Architecture card
                _buildArchCard(theme),
                const SizedBox(height: 16),

                // Configuration card
                _buildConfigCard(theme),
                const SizedBox(height: 16),

                // Actions card
                _buildActionsCard(theme),
                const SizedBox(height: 16),

                // Result card
                if (_resolveResult != null) ...[
                  _buildResultCard(theme),
                  const SizedBox(height: 16),
                ],

                // Console
                _buildConsole(theme),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildArchCard(ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('How It Works', style: theme.textTheme.titleMedium),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _archNode(
                    '🌐',
                    'Web SDK',
                    'Fingerprint',
                    const Color(0xFF6366F1),
                  ),
                ),
                const Icon(Icons.arrow_forward, size: 16, color: Colors.grey),
                Expanded(
                  child: _archNode(
                    '⚡',
                    'Backend',
                    'Match',
                    const Color(0xFF10B981),
                  ),
                ),
                const Icon(Icons.arrow_forward, size: 16, color: Colors.grey),
                Expanded(
                  child: _archNode(
                    '📱',
                    'This App',
                    'Resolve',
                    const Color(0xFFF59E0B),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _archNode(String icon, String title, String subtitle, Color color) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 4),
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Text(icon, style: const TextStyle(fontSize: 20)),
          const SizedBox(height: 4),
          Text(
            title,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
          Text(
            subtitle,
            style: TextStyle(fontSize: 10, color: color.withOpacity(0.7)),
          ),
        ],
      ),
    );
  }

  Widget _buildConfigCard(ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                    ),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Center(
                    child: Text(
                      '1',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Text('Configuration', style: theme.textTheme.titleMedium),
                const Spacer(),
                _statusBadge(
                  _isConfigured ? 'Configured' : 'Not configured',
                  _isConfigured,
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _apiUrlController,
              decoration: const InputDecoration(
                labelText: 'API Base URL',
                hintText: 'https://console.share-installs.com/api',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.link),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _apiKeyController,
              decoration: const InputDecoration(
                labelText: 'API Key (optional)',
                hintText: 'sk_live_xxxxxxxx',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.key),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _isLoading ? null : _configureSDK,
                icon: const Icon(Icons.settings),
                label: Text(_isLoading ? 'Configuring…' : 'Configure SDK'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionsCard(ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF10B981), Color(0xFF059669)],
                    ),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Center(
                    child: Text(
                      '2',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Text('Actions', style: theme.textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: (!_isConfigured || _isLoading)
                        ? null
                        : _resolveDeferred,
                    icon: const Icon(Icons.search),
                    label: const Text('Resolve'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: !_isConfigured ? null : _clearCache,
                    icon: const Icon(Icons.delete_outline),
                    label: const Text('Clear Cache'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResultCard(ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.check_circle,
                  color: Color(0xFF10B981),
                  size: 20,
                ),
                const SizedBox(width: 8),
                Text('Resolution Result', style: theme.textTheme.titleMedium),
                const Spacer(),
                IconButton(
                  onPressed: () {
                    Clipboard.setData(
                      ClipboardData(text: _resolveResult ?? ''),
                    );
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Copied to clipboard')),
                    );
                  },
                  icon: const Icon(Icons.copy, size: 18),
                  tooltip: 'Copy JSON',
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.black26,
                borderRadius: BorderRadius.circular(8),
              ),
              child: SelectableText(
                _resolveResult ?? '',
                style: TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 13,
                  color: theme.colorScheme.onSurface.withOpacity(0.9),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConsole(ThemeData theme) {
    return Card(
      color: const Color(0xFF0D1117),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                const Icon(Icons.terminal, size: 16, color: Colors.grey),
                const SizedBox(width: 8),
                Text(
                  'Console',
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: Colors.grey,
                  ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () => setState(() => _logs.clear()),
                  child: const Text('Clear', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Colors.white10),
          SizedBox(
            height: 200,
            child: _logs.isEmpty
                ? const Center(
                    child: Text(
                      'No logs yet',
                      style: TextStyle(color: Colors.grey),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _logs.length,
                    itemBuilder: (context, index) {
                      final log = _logs[index];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(
                                text: '[${log.timeStr}] ',
                                style: const TextStyle(
                                  color: Colors.grey,
                                  fontFamily: 'monospace',
                                  fontSize: 11,
                                ),
                              ),
                              TextSpan(
                                text: log.message,
                                style: TextStyle(
                                  color: log.color,
                                  fontFamily: 'monospace',
                                  fontSize: 11,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _statusBadge(String text, bool active) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: (active ? Colors.green : Colors.grey).withOpacity(0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: active ? Colors.green : Colors.grey,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            text,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: active ? Colors.green : Colors.grey,
            ),
          ),
        ],
      ),
    );
  }
}

class _LogEntry {
  final String level;
  final String message;
  final DateTime time;

  _LogEntry({required this.level, required this.message, required this.time});

  String get timeStr =>
      '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}:${time.second.toString().padLeft(2, '0')}';

  Color get color => switch (level) {
    'success' => const Color(0xFF34D399),
    'error' => const Color(0xFFF87171),
    'warn' => const Color(0xFFFBBF24),
    _ => const Color(0xFF93C5FD),
  };
}
