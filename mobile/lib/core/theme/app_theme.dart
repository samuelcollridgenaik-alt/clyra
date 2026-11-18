import 'package:flutter/material.dart';
class ClyraTheme {
  static const navy=Color(0xFF172B50),indigo=Color(0xFF6657D9),teal=Color(0xFF14B8A6),mist=Color(0xFFF7F9FC);
  static ThemeData get light => ThemeData(
    useMaterial3:true,
    colorScheme:ColorScheme.fromSeed(seedColor:indigo,primary:indigo,secondary:teal,surface:Colors.white),
    scaffoldBackgroundColor:mist,
    appBarTheme:const AppBarTheme(backgroundColor:mist,foregroundColor:navy,centerTitle:false),
    cardTheme:CardThemeData(color:Colors.white,shape:RoundedRectangleBorder(borderRadius:BorderRadius.circular(16)),elevation:0),
    inputDecorationTheme:InputDecorationTheme(border:OutlineInputBorder(borderRadius:BorderRadius.circular(12)),filled:true,fillColor:Colors.white,contentPadding:const EdgeInsets.all(14)),
    elevatedButtonTheme:ElevatedButtonThemeData(style:ElevatedButton.styleFrom(backgroundColor:indigo,foregroundColor:Colors.white,minimumSize:const Size.fromHeight(50),shape:RoundedRectangleBorder(borderRadius:BorderRadius.circular(12)))),
  );
}
