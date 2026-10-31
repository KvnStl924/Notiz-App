import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'data/note_store.dart';
import 'ui/note_list_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final store = NoteStore();
  await store.load();
  runApp(ChangeNotifierProvider.value(value: store, child: const NotizApp()));
}

class NotizApp extends StatelessWidget {
  const NotizApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Notizen',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFE07A3F)),
        useMaterial3: true,
        // gleiche Schrift und Animationen auf Android und iOS
        platform: TargetPlatform.android,
      ),
      home: const NoteListPage(),
    );
  }
}
