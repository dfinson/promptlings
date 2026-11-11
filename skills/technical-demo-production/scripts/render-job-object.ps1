param([Parameter(Mandatory = $true)][int]$WorkerId)
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Threading;

public static class RenderJobOwner {
    [StructLayout(LayoutKind.Sequential)]
    struct BasicLimits {
        public long ProcessTime, JobTime;
        public uint Flags;
        public UIntPtr MinWorkingSet, MaxWorkingSet;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct IoCounters {
        public ulong ReadOperations, WriteOperations, OtherOperations;
        public ulong ReadBytes, WriteBytes, OtherBytes;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct ExtendedLimits {
        public BasicLimits Basic;
        public IoCounters Io;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct Accounting {
        public long UserTime, KernelTime, PeriodUserTime, PeriodKernelTime;
        public uint PageFaults, TotalProcesses, ActiveProcesses, TerminatedProcesses;
    }
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetInformationJobObject(IntPtr job, int kind, ref ExtendedLimits limits, uint size);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool QueryInformationJobObject(IntPtr job, int kind, out Accounting info, uint size, IntPtr returned);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr OpenProcess(uint access, bool inherit, int id);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool TerminateJobObject(IntPtr job, uint exitCode);
    [DllImport("kernel32.dll")]
    static extern bool CloseHandle(IntPtr handle);

    static void Check(bool success) {
        if (!success) throw new Win32Exception(Marshal.GetLastWin32Error());
    }
    public static void Run(int workerId) {
        IntPtr job = CreateJobObject(IntPtr.Zero, null);
        Check(job != IntPtr.Zero);
        try {
            ExtendedLimits limits = new ExtendedLimits();
            limits.Basic.Flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            Check(SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(typeof(ExtendedLimits))));
            IntPtr worker = OpenProcess(0x0101, false, workerId); // SET_QUOTA | TERMINATE
            Check(worker != IntPtr.Zero);
            try { Check(AssignProcessToJobObject(job, worker)); }
            finally { CloseHandle(worker); }
            Console.Out.WriteLine("READY");
            Console.Out.Flush();
            // EOF also releases ownership if the supervisor dies.
            Console.In.ReadLine();
            Check(TerminateJobObject(job, 1));
            for (int attempt = 0; attempt < 400; attempt++) {
                Accounting info;
                Check(QueryInformationJobObject(job, 1, out info, (uint)Marshal.SizeOf(typeof(Accounting)), IntPtr.Zero));
                if (info.ActiveProcesses == 0) return;
                Thread.Sleep(25);
            }
            throw new TimeoutException("Render job still contains active processes after termination");
        } finally { CloseHandle(job); }
    }
}
'@
[RenderJobOwner]::Run($WorkerId)
